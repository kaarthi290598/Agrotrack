import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ||
  "https://different-puffin-360.convex.cloud";

function memberDisplayName(data: {
  first_name?: string | null;
  last_name?: string | null;
  identifier?: string | null;
}) {
  const full = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (data.identifier?.includes("@")) return data.identifier.split("@")[0];
  return data.identifier || "User";
}

export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Verification failed", { status: 400 });
  }

  const secret = process.env.CLERK_CONVEX_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_CONVEX_WEBHOOK_SECRET is not configured");
    return new Response("Server misconfigured", { status: 500 });
  }

  const client = new ConvexHttpClient(convexUrl);

  try {
    if (
      evt.type === "organizationMembership.created" ||
      evt.type === "organizationMembership.updated"
    ) {
      const { organization, public_user_data, role } = evt.data;
      const email = public_user_data.identifier || "";
      if (!email || !public_user_data.user_id) {
        return new Response("OK", { status: 200 });
      }

      await client.mutation(api.users.upsertFromWebhook, {
        secret,
        orgId: organization.id,
        clerkUserId: public_user_data.user_id,
        email,
        fullName: memberDisplayName(public_user_data),
        imageUrl: public_user_data.image_url || undefined,
        clerkOrgRole: role,
      });
    }

    if (evt.type === "organizationMembership.deleted") {
      const { organization, public_user_data } = evt.data;
      if (public_user_data.user_id) {
        await client.mutation(api.users.removeFromWebhook, {
          secret,
          orgId: organization.id,
          clerkUserId: public_user_data.user_id,
        });
      }
    }

    // Deleting a user in Clerk does not always emit a membership.deleted event,
    // so clear the user from every organization here.
    if (evt.type === "user.deleted") {
      if (evt.data.id) {
        await client.mutation(api.users.removeAllForClerkUser, {
          secret,
          clerkUserId: evt.data.id,
        });
      }
    }

    if (evt.type === "organization.deleted") {
      if (evt.data.id) {
        await client.mutation(api.users.removeAllForOrg, {
          secret,
          orgId: evt.data.id,
        });
      }
    }
  } catch (err) {
    console.error("Webhook Convex sync failed:", err);
    return new Response("Sync failed", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
