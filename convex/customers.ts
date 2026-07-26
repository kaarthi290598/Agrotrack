import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOrgMember, assertSameOrg } from "./authHelpers";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgMember(ctx);
    return await ctx.db
      .query("customers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgMember(ctx);
    const customer = await ctx.db.get(args.id);
    if (!customer) return null;
    assertSameOrg(customer.orgId, orgId, "Customer");
    return customer;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    mobile: v.string(),
    location: v.optional(v.string()),
    state: v.optional(v.string()),
    pincode: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgMember(ctx);
    return await ctx.db.insert("customers", {
      ...args,
      orgId,
      createdAt: Date.now(),
    });
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
    const { orgId } = await requireOrgMember(ctx);
    const customer = await ctx.db.get(args.id);
    if (!customer) throw new Error("Customer not found");
    assertSameOrg(customer.orgId, orgId, "Customer");

    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const remove = mutation({
  args: { id: v.id("customers") },
  handler: async (ctx, args) => {
    const { orgId } = await requireOrgMember(ctx);
    const customer = await ctx.db.get(args.id);
    if (!customer) throw new Error("Customer not found");
    assertSameOrg(customer.orgId, orgId, "Customer");
    await ctx.db.delete(args.id);
  },
});
