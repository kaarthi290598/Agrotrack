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
    }
    if (!settings) {
      settings = await ctx.db.query("settings").first();
    }

    if (!settings) {
      return {
        hourlyRate: 1200,
        businessName: "Agro Track Machinery Services",
        businessAddress: "NH-48, Agro Junction, Hubli, Karnataka - 580020",
        phoneNumber: "+91 98765 43210",
        gstNumber: "29AAAAA1111A1Z1",
        invoicePrefix: "INV-",
        currencySymbol: "₹",
        defaultTax: 0,
        invoiceNotes: "Thank you for doing business with us! Please pay within 7 days.",
        footerText: "Powered by Agro Track Systems",
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
      existing = await ctx.db.query("settings").first();
    }

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, orgId });
    } else {
      await ctx.db.insert("settings", { ...args, orgId });
    }
  },
});
