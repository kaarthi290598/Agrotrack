import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function getEffectiveOrgId(ctx: any, passedOrgId?: string) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.org_id || (identity as any)?.orgId || passedOrgId;
}

export const getAll = query({
  args: { orgId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const orgId = await getEffectiveOrgId(ctx, args.orgId);
    const all = await ctx.db.query("customers").order("desc").collect();
    if (orgId) {
      return all.filter((c) => c.orgId === orgId);
    }
    return all;
  },
});

export const getById = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    orgId: v.optional(v.string()),
    name: v.string(),
    mobile: v.string(),
    location: v.optional(v.string()),
    state: v.optional(v.string()),
    pincode: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orgId = await getEffectiveOrgId(ctx, args.orgId);
    const customerId = await ctx.db.insert("customers", {
      ...args,
      orgId,
      createdAt: Date.now(),
    });
    return customerId;
  },
});

export const update = mutation({
  args: {
    id: v.id("customers"),
    name: v.optional(v.string()),
    mobile: v.optional(v.string()),
    location: v.optional(v.string()),
    state: v.optional(v.string()),
    pincode: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
