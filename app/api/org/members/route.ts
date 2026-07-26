import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "";

/**
 * Removes a member from both Clerk and Convex.
 *
 * Runs server-side because application ADMINs are plain `org:member` in Clerk and
 * therefore cannot call `organization.removeMember()` from the browser.
 */
export async function DELETE(req: NextRequest) {
  const { userId, orgId: sessionOrgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orgId?: string; userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orgId = String(body.orgId || sessionOrgId || "");
  const convexUserId = String(body.userId || "");

  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization selected" },
      { status: 400 }
    );
  }
  if (sessionOrgId && sessionOrgId !== orgId) {
    return NextResponse.json({ error: "Organization mismatch" }, { status: 403 });
  }
  if (!convexUserId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }
  if (!convexUrl) {
    return NextResponse.json(
      { error: "Convex URL is not configured" },
      { status: 500 }
    );
  }

  const convex = new ConvexHttpClient(convexUrl);

  // Validate before mutating anything so Clerk and Convex cannot drift apart.
  let target: { clerkUserId: string; email: string };
  try {
    target = await convex.query(api.users.getRemovableMember, {
      orgId,
      userId: convexUserId as Id<"users">,
      callerClerkUserId: userId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Member cannot be removed";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  try {
    const clerk = await clerkClient();
    await clerk.organizations.deleteOrganizationMembership({
      organizationId: orgId,
      userId: target.clerkUserId,
    });
  } catch (error) {
    // A missing membership means Clerk is already clean; anything else is fatal.
    const status = (error as { status?: number })?.status;
    if (status !== 404) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to remove Clerk membership";
      console.error("Clerk membership removal failed:", error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    await convex.mutation(api.users.removeMember, {
      orgId,
      userId: convexUserId as Id<"users">,
      callerClerkUserId: userId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove Convex record";
    console.error("Convex member removal failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true, email: target.email });
}
