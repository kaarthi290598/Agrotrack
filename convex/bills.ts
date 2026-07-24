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
    const all = await ctx.db.query("bills").order("desc").collect();
    if (orgId) {
      return all.filter((b) => b.orgId === orgId);
    }
    return all;
  },
});

export const create = mutation({
  args: {
    orgId: v.optional(v.string()),
    customerId: v.string(),
    date: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    hoursUsed: v.number(),
    hourlyRate: v.number(),
    extraCharges: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        amount: v.number(),
      })
    ),
    discount: v.number(),
    grandTotal: v.number(),
    status: v.union(
      v.literal("APPROVED"),
      v.literal("PENDING_APPROVAL"),
      v.literal("REJECTED"),
      v.literal("IN_PROGRESS")
    ),
    paymentStatus: v.union(v.literal("PAID"), v.literal("UNPAID")),
    createdBy: v.optional(v.string()),
    createdByEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orgId = await getEffectiveOrgId(ctx, args.orgId);
    
    // Fetch settings to get invoice prefix
    const settings = await ctx.db.query("settings").first();
    const prefix = settings?.invoicePrefix || "INV-";

    // Calculate max invoice number
    const bills = await ctx.db.query("bills").collect();
    let maxNum = 0;
    bills.forEach((b) => {
      if (b.invoiceNumber.startsWith(prefix)) {
        const suffix = b.invoiceNumber.substring(prefix.length);
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    const invoiceNumber = `${prefix}${String(nextNum).padStart(5, "0")}`;

    const billId = await ctx.db.insert("bills", {
      ...args,
      orgId,
      invoiceNumber,
      createdAt: Date.now(),
    });

    return { id: billId, invoiceNumber };
  },
});

export const update = mutation({
  args: {
    id: v.id("bills"),
    customerId: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    hoursUsed: v.optional(v.number()),
    hourlyRate: v.optional(v.number()),
    extraCharges: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          amount: v.number(),
        })
      )
    ),
    discount: v.optional(v.number()),
    grandTotal: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("APPROVED"),
        v.literal("PENDING_APPROVAL"),
        v.literal("REJECTED"),
        v.literal("IN_PROGRESS")
      )
    ),
    paymentStatus: v.optional(v.union(v.literal("PAID"), v.literal("UNPAID"))),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    await ctx.db.patch(id, fields);
  },
});

export const updatePaymentStatus = mutation({
  args: {
    id: v.id("bills"),
    paymentStatus: v.union(v.literal("PAID"), v.literal("UNPAID")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { paymentStatus: args.paymentStatus });
  },
});

export const approve = mutation({
  args: { id: v.id("bills") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "APPROVED" });
  },
});

export const reject = mutation({
  args: { id: v.id("bills") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: "REJECTED" });
  },
});

export const remove = mutation({
  args: { id: v.id("bills") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
