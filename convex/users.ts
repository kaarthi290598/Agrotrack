import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const appRoleValidator = v.union(
  v.literal("ADMIN"),
  v.literal("SUPERVISOR"),
  v.literal("MEMBER")
);

type AppRole = "ADMIN" | "SUPERVISOR" | "MEMBER";

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
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
  return await ctx.db
    .query("users")
    .withIndex("by_org_clerkUser", (q: any) =>
      q.eq("orgId", orgId).eq("clerkUserId", clerkUserId)
    )
    .unique();
}

async function findPendingInvite(
  ctx: { db: any },
  orgId: string,
  email: string
) {
  return await ctx.db
    .query("pendingInvites")
    .withIndex("by_org_email", (q: any) =>
      q.eq("orgId", orgId).eq("email", normalizeEmail(email))
    )
    .unique();
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

async function resolveClerkUserId(
  ctx: { auth: any },
  fallbackClerkUserId?: string
) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject || fallbackClerkUserId || null;
}

async function requireOrgAdmin(
  ctx: { db: any; auth: any },
  orgId: string,
  fallbackClerkUserId?: string
) {
  const clerkUserId = await resolveClerkUserId(ctx, fallbackClerkUserId);
  if (!clerkUserId) {
    throw new Error("Unauthenticated");
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
    if (identity?.subject && identity.subject !== args.clerkUserId) {
      throw new Error("User mismatch");
    }

    const clerkUserId = identity?.subject || args.clerkUserId;
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

    const role = await resolveCreateRole(
      ctx,
      args.orgId,
      args.email,
      args.clerkOrgRole
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
    callerClerkUserId: v.optional(v.string()),
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
    const caller = await requireOrgAdmin(
      ctx,
      args.orgId,
      args.callerClerkUserId
    );

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
 * Caller should invite the user in Clerk as org:member.
 */
export const createPendingInvite = mutation({
  args: {
    orgId: v.string(),
    email: v.string(),
    role: appRoleValidator,
    callerClerkUserId: v.optional(v.string()),
    clerkInvitationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireOrgAdmin(
      ctx,
      args.orgId,
      args.callerClerkUserId
    );
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
    callerClerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId, args.callerClerkUserId);
    const existing = await findPendingInvite(ctx, args.orgId, args.email);
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const listPendingInvites = query({
  args: {
    orgId: v.string(),
    callerClerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await resolveClerkUserId(ctx, args.callerClerkUserId);
    if (!clerkUserId) return [];

    const caller = await findOrgUser(ctx, args.orgId, clerkUserId);
    if (!caller || caller.role !== "ADMIN") return [];

    const invites = await ctx.db
      .query("pendingInvites")
      .withIndex("by_org_email", (q) => q.eq("orgId", args.orgId))
      .collect();

    return invites.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getCurrentUser = query({
  args: {
    orgId: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await resolveClerkUserId(ctx, args.clerkUserId);
    const identity = await ctx.auth.getUserIdentity();
    const orgId =
      (identity as { org_id?: string; orgId?: string } | null)?.org_id ||
      (identity as { orgId?: string } | null)?.orgId ||
      args.orgId;

    if (!clerkUserId || !orgId) return null;

    return await findOrgUser(ctx, orgId, clerkUserId);
  },
});

export const listByOrg = query({
  args: {
    orgId: v.string(),
    callerClerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await resolveClerkUserId(ctx, args.callerClerkUserId);
    if (!clerkUserId) return [];

    const caller = await findOrgUser(ctx, args.orgId, clerkUserId);
    if (!caller || caller.role !== "ADMIN") {
      return [];
    }

    const members = await ctx.db
      .query("users")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    return members.sort((a, b) => a.fullName.localeCompare(b.fullName));
  },
});

export const updateRole = mutation({
  args: {
    orgId: v.string(),
    userId: v.id("users"),
    role: appRoleValidator,
    callerClerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrgAdmin(ctx, args.orgId, args.callerClerkUserId);

    const target = await ctx.db.get(args.userId);
    if (!target || target.orgId !== args.orgId) {
      throw new Error("User not found in this organization");
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
  userId: any,
  callerClerkUserId?: string
) {
  const caller = await requireOrgAdmin(ctx, orgId, callerClerkUserId);

  const target = await ctx.db.get(userId);
  if (!target || target.orgId !== orgId) {
    throw new Error("User not found in this organization");
  }

  if (target.clerkUserId === caller.clerkUserId) {
    throw new Error("You cannot remove yourself");
  }

  // Keep at least one ADMIN in the org
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

/**
 * Pre-flight check used by the server route before removing the Clerk membership,
 * so Clerk and Convex are not left out of sync when the removal is not allowed.
 */
export const getRemovableMember = query({
  args: {
    orgId: v.string(),
    userId: v.id("users"),
    callerClerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const target = await assertRemovable(
      ctx,
      args.orgId,
      args.userId,
      args.callerClerkUserId
    );
    return { clerkUserId: target.clerkUserId, email: target.email };
  },
});

/** Remove a member's Convex user record (ADMIN only). Does not change Clerk by itself. */
export const removeMember = mutation({
  args: {
    orgId: v.string(),
    userId: v.id("users"),
    callerClerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const target = await assertRemovable(
      ctx,
      args.orgId,
      args.userId,
      args.callerClerkUserId
    );

    await ctx.db.delete(args.userId);
    return { clerkUserId: target.clerkUserId, email: target.email };
  },
});
