import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function getEffectiveOrgId(ctx: any, passedOrgId?: string) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.org_id || (identity as any)?.orgId || passedOrgId;
}

export const get = query({
  args: { orgId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const orgId = await getEffectiveOrgId(ctx, args.orgId);
    let settings;
    if (orgId) {
      settings = await ctx.db
        .query("settings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first();
    } else {
      // Personal workspace only — never borrow another org's settings
      const all = await ctx.db.query("settings").collect();
      settings = all.find((s) => !s.orgId);
    }

    if (!settings) {
      return {
        hourlyRate: 1200,
        businessName: "My Business",
        businessAddress: "",
        phoneNumber: "",
        gstNumber: "",
        invoicePrefix: "INV-",
        currencySymbol: "₹",
        defaultTax: 0,
        invoiceNotes: "",
        footerText: "",
      };
    }
    return settings;
  },
});

export const update = mutation({
  args: {
    orgId: v.optional(v.string()),
    hourlyRate: v.number(),
    businessName: v.string(),
    businessAddress: v.string(),
    phoneNumber: v.string(),
    gstNumber: v.optional(v.string()),
    invoicePrefix: v.string(),
    currencySymbol: v.string(),
    defaultTax: v.number(),
    invoiceNotes: v.optional(v.string()),
    footerText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orgId = await getEffectiveOrgId(ctx, args.orgId);
    let existing;
    if (orgId) {
      existing = await ctx.db
        .query("settings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first();
    } else {
      const all = await ctx.db.query("settings").collect();
      existing = all.find((s) => !s.orgId);
    }

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, orgId });
    } else {
      await ctx.db.insert("settings", { ...args, orgId });
    }
  },
});
