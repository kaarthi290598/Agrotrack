import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getAppUrl, isLocalHost } from "../../../../lib/app-url";

export async function POST(req: NextRequest) {
  const { userId, orgId: sessionOrgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; orgId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const orgId = String(body.orgId || sessionOrgId || "");

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
    return NextResponse.json(
      { error: "Organization mismatch" },
      { status: 403 }
    );
  }

  const appUrl = getAppUrl(req);

  // Invitation emails permanently embed this URL. Without NEXT_PUBLIC_APP_URL,
  // inviting from a local machine always sends invitees to localhost.
  // Invitation emails permanently embed this URL. Without NEXT_PUBLIC_APP_URL,
  // inviting from a local machine always sends invitees to localhost.
  if (isLocalHost(appUrl) && !process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    return NextResponse.json(
      {
        error:
          "Set NEXT_PUBLIC_APP_URL to your public app URL (e.g. https://your-app.vercel.app) before sending invites. Without it, invite links redirect to localhost.",
      },
      { status: 400 }
    );
  }

  const redirectUrl = `${appUrl}/accept-invitation`;

  try {
    const clerk = await clerkClient();
    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: orgId,
      inviterUserId: userId,
      emailAddress: email,
      role: "org:member",
      redirectUrl,
    });

    return NextResponse.json({
      id: invitation.id,
      redirectUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create invitation";
    console.error("Organization invite failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Revokes the pending Clerk invitation so cancelling in the app also cancels the email link. */
export async function DELETE(req: NextRequest) {
  const { userId, orgId: sessionOrgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { email?: string; orgId?: string; invitationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const orgId = String(body.orgId || sessionOrgId || "");

  if (!orgId) {
    return NextResponse.json(
      { error: "No active organization selected" },
      { status: 400 }
    );
  }
  if (sessionOrgId && sessionOrgId !== orgId) {
    return NextResponse.json({ error: "Organization mismatch" }, { status: 403 });
  }

  try {
    const clerk = await clerkClient();
    let invitationId = body.invitationId;

    if (!invitationId && email) {
      const pending = await clerk.organizations.getOrganizationInvitationList({
        organizationId: orgId,
        status: ["pending"],
        limit: 100,
      });
      invitationId = pending.data.find(
        (invite) => invite.emailAddress.toLowerCase() === email
      )?.id;
    }

    if (!invitationId) {
      return NextResponse.json({ success: true, revoked: false });
    }

    await clerk.organizations.revokeOrganizationInvitation({
      organizationId: orgId,
      invitationId,
      requestingUserId: userId,
    });

    return NextResponse.json({ success: true, revoked: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to revoke invitation";
    console.error("Organization invite revoke failed:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
