import type { UserIdentity } from "convex/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

export type AppRole = "ADMIN" | "SUPERVISOR" | "MEMBER";

type AuthCtx = QueryCtx | MutationCtx;

export type AuthUser = {
  clerkUserId: string;
  orgId: string;
  email?: string;
  /** Clerk org role, e.g. org:admin / org:member */
  clerkOrgRole?: string;
};

type IdentityClaims = UserIdentity & {
  org_id?: string;
  orgId?: string;
  org_role?: string;
  orgRole?: string;
  o?: { id?: string; rol?: string; slg?: string };
  "o.id"?: string;
  "o.rol"?: string;
};

function asClaims(identity: UserIdentity | null): IdentityClaims | null {
  return identity as IdentityClaims | null;
}

/** Read active org id from JWT template claims or Clerk session token `o` claim. */
export function getOrgIdFromIdentity(
  identity: UserIdentity | null
): string | null {
  const claims = asClaims(identity);
  if (!claims) return null;

  const fromFlat = claims.org_id || claims.orgId;
  if (typeof fromFlat === "string" && fromFlat) return fromFlat;

  const fromNested = claims.o?.id || claims["o.id"];
  if (typeof fromNested === "string" && fromNested) return fromNested;

  return null;
}

/** Read Clerk org role (normalized to org:* when possible). */
export function getOrgRoleFromIdentity(
  identity: UserIdentity | null
): string | undefined {
  const claims = asClaims(identity);
  if (!claims) return undefined;

  const flat = claims.org_role || claims.orgRole;
  if (typeof flat === "string" && flat) return flat;

  const compact = claims.o?.rol || claims["o.rol"];
  if (typeof compact === "string" && compact) {
    return compact.startsWith("org:") ? compact : `org:${compact}`;
  }

  return undefined;
}

/** Require a signed-in Clerk user with an active organization in the JWT. */
export async function requireIdentity(ctx: AuthCtx): Promise<AuthUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Unauthenticated");
  }

  const orgId = getOrgIdFromIdentity(identity);
  if (!orgId) {
    throw new Error(
      "No active organization in auth token. Select an organization, or add org_id/{{org.id}} to your Clerk Convex JWT / session claims."
    );
  }

  return {
    clerkUserId: identity.subject,
    orgId,
    email: identity.email,
    clerkOrgRole: getOrgRoleFromIdentity(identity),
  };
}

/** Load the Convex app-role record for the authenticated org member. */
export async function requireOrgMember(
  ctx: AuthCtx
): Promise<AuthUser & { role: AppRole; userId: string }> {
  const auth = await requireIdentity(ctx);
  const record = await ctx.db
    .query("users")
    .withIndex("by_org_clerkUser", (q) =>
      q.eq("orgId", auth.orgId).eq("clerkUserId", auth.clerkUserId)
    )
    .collect();

  if (!record[0]) {
    throw new Error("Not a member of this organization");
  }

  return {
    ...auth,
    role: record[0].role as AppRole,
    userId: record[0]._id,
  };
}

export async function requireAppRole(
  ctx: AuthCtx,
  allowed: AppRole[]
): Promise<AuthUser & { role: AppRole; userId: string }> {
  const member = await requireOrgMember(ctx);
  if (!allowed.includes(member.role)) {
    throw new Error("Forbidden");
  }
  return member;
}

export async function requireAdmin(ctx: AuthCtx) {
  return requireAppRole(ctx, ["ADMIN"]);
}

export async function requireElevated(ctx: AuthCtx) {
  return requireAppRole(ctx, ["ADMIN", "SUPERVISOR"]);
}

/** Ensure a document belongs to the caller's org (IDOR guard). */
export function assertSameOrg(
  recordOrgId: string | undefined | null,
  callerOrgId: string,
  label = "Record"
) {
  if (!recordOrgId || recordOrgId !== callerOrgId) {
    throw new Error(`${label} not found`);
  }
}
