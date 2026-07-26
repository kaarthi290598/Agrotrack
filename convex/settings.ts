import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOrgMember, requireAdmin } from "./authHelpers";

const defaultSettings = {
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

export const get = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgMember(ctx);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (!settings) return defaultSettings;
    return settings;
  },
});

export const update = mutation({
  args: {
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
    const { orgId } = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, orgId });
    } else {
      await ctx.db.insert("settings", { ...args, orgId });
    }
  },
});
