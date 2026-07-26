import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getServerAuthedConvex } from "../../../../lib/convex-client";

type AppRole = "ADMIN" | "SUPERVISOR" | "MEMBER";

function memberDisplayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses?: { emailAddress: string }[];
}) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (email?.includes("@")) return email.split("@")[0];
  return email || "User";
}

function randomTempPassword() {
  return `Tmp!${randomBytes(24).toString("base64url")}`;
}

/**
 * Creates (or finds) a Clerk user, writes Convex role first, then org membership.
 */
export async function POST(req: NextRequest) {
  const { userId, orgId: sessionOrgId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; orgId?: string; role?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const orgId = String(body.orgId || sessionOrgId || "");
  const role = (String(body.role || "MEMBER").toUpperCase() ||
    "MEMBER") as AppRole;
  const fullNameHint = String(body.fullName || "").trim();

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization selected" },
      { status: 400 }
    );
  }
  if (sessionOrgId && sessionOrgId !== orgId) {
    return NextResponse.json({ error: "Organization mismatch" }, { status: 403 });
  }
  if (!["ADMIN", "SUPERVISOR", "MEMBER"].includes(role)) {
    return NextResponse.json({ error: "Invalid application role" }, { status: 400 });
  }

  let convex;
  try {
    convex = await getServerAuthedConvex(getToken);
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const me = await convex.query(api.users.getCurrentUser, {});
    if (!me || me.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only ADMIN users can add members" },
        { status: 403 }
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify permissions";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const clerk = await clerkClient();
  let clerkUserId: string;
  let createdUser = false;
  let usedTempPassword = false;
  let imageUrl: string | undefined;
  let fullName = fullNameHint || email.split("@")[0];

  try {
    const existing = await clerk.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });

    if (existing.data.length > 0) {
      const user = existing.data[0];
      clerkUserId = user.id;
      imageUrl = user.imageUrl || undefined;
      fullName = memberDisplayName(user) || fullName;
    } else {
      let user;
      try {
        user = await clerk.users.createUser({
          emailAddress: [email],
          firstName: fullNameHint || undefined,
          skipPasswordRequirement: true,
        });
      } catch (createError) {
        const message =
          createError instanceof Error ? createError.message : String(createError);
        if (
          /password/i.test(message) ||
          /skip_password/i.test(message) ||
          /required/i.test(message)
        ) {
          user = await clerk.users.createUser({
            emailAddress: [email],
            firstName: fullNameHint || undefined,
            password: randomTempPassword(),
            skipPasswordChecks: true,
          });
          usedTempPassword = true;
        } else {
          throw createError;
        }
      }

      clerkUserId = user.id;
      imageUrl = user.imageUrl || undefined;
      fullName = memberDisplayName(user) || fullName;
      createdUser = true;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create Clerk user";
    console.error("Clerk user create/lookup failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let savedRole: AppRole = role;
  try {
    const saved = await convex.mutation(api.users.upsertCreatedMember, {
      orgId,
      clerkUserId,
      email,
      fullName,
      imageUrl,
      role,
    });
    savedRole = (saved?.role as AppRole) || role;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save Convex member";
    console.error("Convex member upsert failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await clerk.organizations.createOrganizationMembership({
      organizationId: orgId,
      userId: clerkUserId,
      role: "org:member",
    });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    const message =
      error instanceof Error ? error.message : "Failed to add org membership";
    if (status !== 400 && status !== 409 && !/already/i.test(message)) {
      console.error("Clerk membership create failed:", error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    const saved = await convex.mutation(api.users.upsertCreatedMember, {
      orgId,
      clerkUserId,
      email,
      fullName,
      imageUrl,
      role: savedRole,
    });
    savedRole = (saved?.role as AppRole) || savedRole;
  } catch (error) {
    console.error("Convex role re-assert failed:", error);
  }

  return NextResponse.json({
    success: true,
    clerkUserId,
    email,
    role: savedRole,
    createdUser,
    usedTempPassword,
  });
}

export async function DELETE(req: NextRequest) {
  const { userId, orgId: sessionOrgId, getToken } = await auth();
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

  let convex;
  try {
    convex = await getServerAuthedConvex(getToken);
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  let target: { clerkUserId: string; email: string };
  try {
    target = await convex.query(api.users.getRemovableMember, {
      orgId,
      userId: convexUserId as Id<"users">,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Member cannot be removed";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  try {
    const clerk = await clerkClient();

    try {
      await clerk.organizations.deleteOrganizationMembership({
        organizationId: orgId,
        userId: target.clerkUserId,
      });
    } catch (error) {
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

    let deletedClerkUser = false;
    try {
      const remaining = await clerk.users.getOrganizationMembershipList({
        userId: target.clerkUserId,
        limit: 10,
      });
      if (remaining.data.length === 0) {
        await clerk.users.deleteUser(target.clerkUserId);
        deletedClerkUser = true;
      }
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status !== 404) {
        console.error("Clerk user delete failed:", error);
      }
    }

    try {
      await convex.mutation(api.users.removeMember, {
        orgId,
        userId: convexUserId as Id<"users">,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove Convex record";
      console.error("Convex member removal failed:", error);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      email: target.email,
      deletedClerkUser,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove member";
    console.error("Member removal failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
