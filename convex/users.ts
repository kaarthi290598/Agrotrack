import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getOrgIdFromIdentity,
  getOrgRoleFromIdentity,
} from "./authHelpers";

const appRoleValidator = v.union(
  v.literal("ADMIN"),
  v.literal("SUPERVISOR"),
  v.literal("MEMBER")
);

type AppRole = "ADMIN" | "SUPERVISOR" | "MEMBER";

/** Newly created members are exempt from pruning while Clerk lists catch up. */
const PRUNE_GRACE_MS = 10 * 60 * 1000;

/**
 * After an intentional remove, block sync/webhook from recreating the row while
 * Clerk's membership cache still lists the user.
 */
const REMOVAL_BLOCK_MS = 10 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

async function findRemovalBlock(
  ctx: { db: any },
  orgId: string,
  clerkUserId: string
) {
  const rows = await ctx.db
    .query("removedMemberships")
    .withIndex("by_org_clerkUser", (q: any) =>
      q.eq("orgId", orgId).eq("clerkUserId", clerkUserId)
    )
    .collect();
  return rows[0] || null;
}

async function isRecentlyRemoved(
  ctx: { db: any },
  orgId: string,
  clerkUserId: string,
  now = Date.now()
) {
  const block = await findRemovalBlock(ctx, orgId, clerkUserId);
  if (!block) return false;
  if (now - block.removedAt > REMOVAL_BLOCK_MS) {
    await ctx.db.delete(block._id);
    return false;
  }
  return true;
}

async function markRemoved(
  ctx: { db: any },
  orgId: string,
  clerkUserId: string
) {
  const now = Date.now();
  const existing = await findRemovalBlock(ctx, orgId, clerkUserId);
  if (existing) {
    await ctx.db.patch(existing._id, { removedAt: now });
    return;
  }
  await ctx.db.insert("removedMemberships", {
    orgId,
    clerkUserId,
    removedAt: now,
  });
}

async function clearRemovalBlock(
  ctx: { db: any },
  orgId: string,
  clerkUserId: string
) {
  const existing = await findRemovalBlock(ctx, orgId, clerkUserId);
  if (existing) {
    await ctx.db.delete(existing._id);
  }
}

function clerkOrgRoleToAppRole(clerkOrgRole?: string | null): AppRole {
  // Org creator is org:admin → ADMIN; invited members default to MEMBER
  // (unless a pending invite specifies another Convex role).
  return clerkOrgRole === "org:admin" ? "ADMIN" : "MEMBER";
}

async function findOrgUser(
  ctx: { db: any },
  orgId: string,
  clerkUserId: string
) {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_org_clerkUser", (q: any) =>
      q.eq("orgId", orgId).eq("clerkUserId", clerkUserId)
    )
    .collect();

  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];

  // Dedupe race leftovers — keep highest app role, newest updatedAt as tiebreaker.
  const rank: Record<AppRole, number> = {
    ADMIN: 3,
    SUPERVISOR: 2,
    MEMBER: 1,
  };
  rows.sort((a: any, b: any) => {
    const roleDiff = (rank[b.role as AppRole] || 0) - (rank[a.role as AppRole] || 0);
    if (roleDiff !== 0) return roleDiff;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  const keeper = rows[0];
  for (const extra of rows.slice(1)) {
    await ctx.db.delete(extra._id);
  }
  return keeper;
}

async function findPendingInvite(
  ctx: { db: any },
  orgId: string,
  email: string
) {
  const rows = await ctx.db
    .query("pendingInvites")
    .withIndex("by_org_email", (q: any) =>
      q.eq("orgId", orgId).eq("email", normalizeEmail(email))
    )
    .collect();
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  // Keep newest pending role intent
  rows.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
  const keeper = rows[0];
  for (const extra of rows.slice(1)) {
    await ctx.db.delete(extra._id);
  }
  return keeper;
}

/** Prefer pending-invite role; fall back to Clerk org-role mapping. Consumes the invite. */
async function resolveCreateRole(
  ctx: { db: any },
  orgId: string,
  email: string,
  clerkOrgRole?: string | null
): Promise<AppRole> {
  const pending = await findPendingInvite(ctx, orgId, email);
  if (pending) {
    const role = pending.role as AppRole;
    await ctx.db.delete(pending._id);
    return role;
  }
  return clerkOrgRoleToAppRole(clerkOrgRole);
}

/**
 * Read intended app role without consuming it (used when upserting before
 * Clerk membership so webhook/sync cannot invent MEMBER).
 */
async function peekPendingRole(
  ctx: { db: any },
  orgId: string,
  email: string
): Promise<AppRole | null> {
  const pending = await findPendingInvite(ctx, orgId, email);
  return pending ? (pending.role as AppRole) : null;
}

async function resolveClerkUserId(ctx: { auth: any }) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject || null;
}

async function requireOrgAdmin(ctx: { db: any; auth: any }, orgId: string) {
  const clerkUserId = await resolveClerkUserId(ctx);
  if (!clerkUserId) {
    throw new Error("Unauthenticated");
  }

  const identity = await ctx.auth.getUserIdentity();
  const tokenOrgId = getOrgIdFromIdentity(identity);
  if (!tokenOrgId) {
    throw new Error(
      "No active organization in auth token. Select an organization, or ensure Clerk session/JWT includes org claims."
    );
  }
  if (tokenOrgId !== orgId) {
    throw new Error("Organization mismatch");
  }

  const caller = await findOrgUser(ctx, orgId, clerkUserId);
  if (!caller || caller.role !== "ADMIN") {
    throw new Error("Only ADMIN users can manage roles");
  }

  return caller;
}

/**
 * Upsert the signed-in user's Convex record for the active org.
 * Creates with pending-invite role (if any) or ADMIN/MEMBER from Clerk org role.
 */
export const ensureCurrentUser = mutation({
  args: {
    orgId: v.string(),
    clerkUserId: v.string(),
    email: v.string(),
    fullName: v.string(),
    imageUrl: v.optional(v.string()),
    clerkOrgRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new Error("Unauthenticated");
    }
    if (identity.subject !== args.clerkUserId) {
      throw new Error("User mismatch");
    }

    const tokenOrgId = getOrgIdFromIdentity(identity);
    if (!tokenOrgId) {
      throw new Error(
        "No active organization in auth token. Ensure the Clerk JWT template \"convex\" includes org_id: {{org.id}}, then sign out and back in."
      );
    }
    if (tokenOrgId !== args.orgId) {
      throw new Error(
        `Organization mismatch (token=${tokenOrgId}, client=${args.orgId})`
      );
    }

    const clerkUserId = identity.subject;
    const now = Date.now();
    const existing = await findOrgUser(ctx, args.orgId, clerkUserId);

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        fullName: args.fullName,
        imageUrl: args.imageUrl,
        updatedAt: now,
      });
      return existing._id;
    }

    // Prefer role from the verified token over client-supplied clerkOrgRole.
    const tokenOrgRole = getOrgRoleFromIdentity(identity);
    const role = await resolveCreateRole(
      ctx,
      args.orgId,
      args.email,
      tokenOrgRole || args.clerkOrgRole
    );

    return await ctx.db.insert("users", {
      clerkUserId,
      orgId: args.orgId,
      email: args.email,
      fullName: args.fullName,
      imageUrl: args.imageUrl,
      role,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Sync Clerk organization members into Convex.
 * Creates missing records; updates profile details; never overwrites existing Convex roles.
 */
export const syncOrgMembers = mutation({
  args: {
    orgId: v.string(),
    /** Only set when `members` is the complete Clerk membership list. */
    prune: v.optional(v.boolean()),
    members: v.array(
      v.object({
        clerkUserId: v.string(),
        email: v.string(),
        fullName: v.string(),
        imageUrl: v.optional(v.string()),
        clerkOrgRole: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const caller = await requireOrgAdmin(ctx, args.orgId);

    const now = Date.now();
    let created = 0;
    let updated = 0;
    let removed = 0;

    for (const member of args.members) {
      const existing = await findOrgUser(ctx, args.orgId, member.clerkUserId);
      if (existing) {
        await ctx.db.patch(existing._id, {
          email: member.email,
          fullName: member.fullName,
          imageUrl: member.imageUrl,
          updatedAt: now,
        });
        updated += 1;
      } else {
        // Stale Clerk lists often still include a just-deleted member.
        if (await isRecentlyRemoved(ctx, args.orgId, member.clerkUserId, now)) {
          continue;
        }
        const role = await resolveCreateRole(
          ctx,
          args.orgId,
          member.email,
          member.clerkOrgRole
        );
        await ctx.db.insert("users", {
          clerkUserId: member.clerkUserId,
          orgId: args.orgId,
          email: member.email,
          fullName: member.fullName,
          imageUrl: member.imageUrl,
          role,
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
      }
    }

    // Drop Convex records for users who are no longer Clerk members
    if (args.prune) {
      const clerkUserIds = new Set(args.members.map((m) => m.clerkUserId));
      const stored = await ctx.db
        .query("users")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();

      for (const record of stored) {
        if (clerkUserIds.has(record.clerkUserId)) continue;
        if (record.clerkUserId === caller.clerkUserId) continue;
        // A freshly added member is often missing from the client's cached
        // Clerk membership list. Pruning them here would drop their app role,
        // and the next sync would recreate them as MEMBER.
        const createdAt = record.createdAt ?? record._creationTime;
        if (now - createdAt < PRUNE_GRACE_MS) continue;
        await ctx.db.delete(record._id);
        removed += 1;
      }
    }

    return { created, updated, removed };
  },
});

/** Used by Clerk webhooks — gated by shared secret. */
export const upsertFromWebhook = mutation({
  args: {
    secret: v.string(),
    orgId: v.string(),
    clerkUserId: v.string(),
    email: v.string(),
    fullName: v.string(),
    imageUrl: v.optional(v.string()),
    clerkOrgRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expected = process.env.CLERK_CONVEX_WEBHOOK_SECRET;
    if (!expected || args.secret !== expected) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const existing = await findOrgUser(ctx, args.orgId, args.clerkUserId);

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        fullName: args.fullName,
        imageUrl: args.imageUrl,
        updatedAt: now,
      });
      return existing._id;
    }

    if (await isRecentlyRemoved(ctx, args.orgId, args.clerkUserId, now)) {
      return null;
    }

    const role = await resolveCreateRole(
      ctx,
      args.orgId,
      args.email,
      args.clerkOrgRole
    );

    return await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      orgId: args.orgId,
      email: args.email,
      fullName: args.fullName,
      imageUrl: args.imageUrl,
      role,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeFromWebhook = mutation({
  args: {
    secret: v.string(),
    orgId: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.CLERK_CONVEX_WEBHOOK_SECRET;
    if (!expected || args.secret !== expected) {
      throw new Error("Unauthorized");
    }

    const existing = await findOrgUser(ctx, args.orgId, args.clerkUserId);
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    await markRemoved(ctx, args.orgId, args.clerkUserId);
  },
});

/** Clerk `user.deleted` — drop the user from every organization. */
export const removeAllForClerkUser = mutation({
  args: {
    secret: v.string(),
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.CLERK_CONVEX_WEBHOOK_SECRET;
    if (!expected || args.secret !== expected) {
      throw new Error("Unauthorized");
    }

    const records = await ctx.db
      .query("users")
      .withIndex("by_clerkUser", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();

    for (const record of records) {
      await markRemoved(ctx, record.orgId, args.clerkUserId);
      await ctx.db.delete(record._id);
    }

    return { removed: records.length };
  },
});

/** Clerk `organization.deleted` — drop all members and invites for that org. */
export const removeAllForOrg = mutation({
  args: {
    secret: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    const expected = process.env.CLERK_CONVEX_WEBHOOK_SECRET;
    if (!expected || args.secret !== expected) {
      throw new Error("Unauthorized");
    }

    const records = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    for (const record of records) {
      await ctx.db.delete(record._id);
    }

    const invites = await ctx.db
      .query("pendingInvites")
      .withIndex("by_org_email", (q) => q.eq("orgId", args.orgId))
      .collect();
    for (const invite of invites) {
      await ctx.db.delete(invite._id);
    }

    return { removed: records.length, invitesRemoved: invites.length };
  },
});

/**
 * Record a pending invite with the intended Convex application role.
 * Kept for internal staging; not used by the UI invite flow.
 */
export const createPendingInvite = mutation({
  args: {
    orgId: v.string(),
    email: v.string(),
    role: appRoleValidator,
    clerkInvitationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireOrgAdmin(ctx, args.orgId);
    const email = normalizeEmail(args.email);
    if (!email.includes("@")) {
      throw new Error("Invalid email address");
    }

    const existing = await findPendingInvite(ctx, args.orgId, email);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        role: args.role,
        invitedByClerkUserId: caller.clerkUserId,
        clerkInvitationId: args.clerkInvitationId,
        createdAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("pendingInvites", {
      orgId: args.orgId,
      email,
      role: args.role,
      invitedByClerkUserId: caller.clerkUserId,
      clerkInvitationId: args.clerkInvitationId,
      createdAt: now,
    });
  },
});

export const cancelPendingInvite = mutation({
  args: {
    orgId: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);
    const existing = await findPendingInvite(ctx, args.orgId, args.email);
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/** Remove all staged/leftover pending-invite rows for an org. */
export const clearPendingInvites = mutation({
  args: {
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);
    const invites = await ctx.db
      .query("pendingInvites")
      .withIndex("by_org_email", (q: any) => q.eq("orgId", args.orgId))
      .collect();
    for (const invite of invites) {
      await ctx.db.delete(invite._id);
    }
    return { removed: invites.length };
  },
});

export const listPendingInvites = query({
  args: {
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await requireOrgAdmin(ctx, args.orgId);
    } catch {
      return [];
    }

    const invites = await ctx.db
      .query("pendingInvites")
      .withIndex("by_org_email", (q) => q.eq("orgId", args.orgId))
      .collect();

    return invites.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const clerkUserId = await resolveClerkUserId(ctx);
    const identity = await ctx.auth.getUserIdentity();
    const orgId = getOrgIdFromIdentity(identity);

    if (!clerkUserId || !orgId) return null;

    return await findOrgUser(ctx, orgId, clerkUserId);
  },
});

export const listByOrg = query({
  args: {
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      await requireOrgAdmin(ctx, args.orgId);
    } catch {
      return [];
    }

    const members = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    return members.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
});

/**
 * Upsert a member created/added via the server (no Clerk invite).
 * Sets the Convex application role explicitly. ADMIN only.
 */
export const upsertCreatedMember = mutation({
  args: {
    orgId: v.string(),
    clerkUserId: v.string(),
    email: v.string(),
    fullName: v.string(),
    imageUrl: v.optional(v.string()),
    role: appRoleValidator,
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId);

    const email = normalizeEmail(args.email);
    const now = Date.now();

    // Explicit admin add overrides a prior removal block.
    await clearRemovalBlock(ctx, args.orgId, args.clerkUserId);

    const staged = await peekPendingRole(ctx, args.orgId, email);
    const role = args.role || staged || "MEMBER";

    const pending = await findPendingInvite(ctx, args.orgId, email);
    if (pending) {
      await ctx.db.delete(pending._id);
    }

    const existing = await findOrgUser(ctx, args.orgId, args.clerkUserId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        email,
        fullName: args.fullName,
        imageUrl: args.imageUrl,
        role,
        updatedAt: now,
      });
      return { userId: existing._id, role };
    }

    const userId = await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      orgId: args.orgId,
      email,
      fullName: args.fullName,
      imageUrl: args.imageUrl,
      role,
      createdAt: now,
      updatedAt: now,
    });
    return { userId, role };
  },
});

export const updateRole = mutation({
  args: {
    orgId: v.string(),
    userId: v.id("users"),
    role: appRoleValidator,
  },
  handler: async (ctx, args) => {
    const caller = await requireOrgAdmin(ctx, args.orgId);

    const target = await ctx.db.get(args.userId);
    if (!target || target.orgId !== args.orgId) {
      throw new Error("User not found in this organization");
    }

    const isSelf = target.clerkUserId === caller.clerkUserId;

    // Demoting someone else from ADMIN is blocked when they are the last one.
    // Admins may change their own role freely (including leaving ADMIN).
    if (!isSelf && target.role === "ADMIN" && args.role !== "ADMIN") {
      const members = await ctx.db
        .query("users")
        .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
        .collect();
      const adminCount = members.filter((u) => u.role === "ADMIN").length;
      if (adminCount <= 1) {
        throw new Error("Cannot demote the last ADMIN");
      }
    }

    await ctx.db.patch(args.userId, {
      role: args.role,
      updatedAt: Date.now(),
    });

    return args.userId;
  },
});

async function assertRemovable(
  ctx: { db: any; auth: any },
  orgId: string,
  userId: any
) {
  const caller = await requireOrgAdmin(ctx, orgId);

  const target = await ctx.db.get(userId);
  if (!target || target.orgId !== orgId) {
    throw new Error("User not found in this organization");
  }

  if (target.clerkUserId === caller.clerkUserId) {
    throw new Error("You cannot remove yourself");
  }

  if (target.role === "ADMIN") {
    const members = await ctx.db
      .query("users")
      .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
      .collect();
    const adminCount = members.filter(
      (u: { role: AppRole }) => u.role === "ADMIN"
    ).length;
    if (adminCount <= 1) {
      throw new Error("Cannot remove the last ADMIN");
    }
  }

  return target;
}

export const getRemovableMember = query({
  args: {
    orgId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const target = await assertRemovable(ctx, args.orgId, args.userId);
    return { clerkUserId: target.clerkUserId, email: target.email };
  },
});

export const removeMember = mutation({
  args: {
    orgId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const target = await assertRemovable(ctx, args.orgId, args.userId);
    await markRemoved(ctx, args.orgId, target.clerkUserId);
    await ctx.db.delete(args.userId);
    return { clerkUserId: target.clerkUserId, email: target.email };
  },
});
