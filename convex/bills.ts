import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  requireOrgMember,
  requireElevated,
  requireAdmin,
  assertSameOrg,
} from "./authHelpers";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgMember(ctx);
    return await ctx.db
      .query("bills")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    customerId: v.string(),
    customerName: v.optional(v.string()),
    customerMobile: v.optional(v.string()),
    customerLocation: v.optional(v.string()),
    customerState: v.optional(v.string()),
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
    paymentStatus: v.union(
      v.literal("PAID"),
      v.literal("UNPAID"),
      v.literal("PARTIAL_PAID")
    ),
    amountPaid: v.optional(v.number()),
    balanceAmount: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    createdByEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId, clerkUserId, role } = await requireOrgMember(ctx);

    // Members cannot self-approve
    let status = args.status;
    if (role === "MEMBER" && status === "APPROVED") {
      status = "PENDING_APPROVAL";
    }

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    const prefix = settings?.invoicePrefix || "INV-";

    const orgBills = await ctx.db
      .query("bills")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    let maxNum = 0;
    for (const b of orgBills) {
      if (b.invoiceNumber.startsWith(prefix)) {
        const suffix = b.invoiceNumber.substring(prefix.length);
        const num = parseInt(suffix, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    }

    const invoiceNumber = `${prefix}${String(maxNum + 1).padStart(5, "0")}`;

    const billId = await ctx.db.insert("bills", {
      ...args,
      status,
      orgId,
      createdBy: args.createdBy || clerkUserId,
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
    customerName: v.optional(v.string()),
    customerMobile: v.optional(v.string()),
    customerLocation: v.optional(v.string()),
    customerState: v.optional(v.string()),
    date: v.optional(v.string()),
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
    paymentStatus: v.optional(
      v.union(
        v.literal("PAID"),
        v.literal("UNPAID"),
        v.literal("PARTIAL_PAID")
      )
    ),
    amountPaid: v.optional(v.number()),
    balanceAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { orgId, role, clerkUserId } = await requireOrgMember(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");

    if (role === "MEMBER" && bill.createdBy && bill.createdBy !== clerkUserId) {
      throw new Error("Forbidden");
    }

    const { id, ...fields } = args;
    if (role === "MEMBER" && fields.status === "APPROVED") {
      fields.status = "PENDING_APPROVAL";
    }

    await ctx.db.patch(id, fields);
  },
});

export const updatePaymentStatus = mutation({
  args: {
    id: v.id("bills"),
    paymentStatus: v.union(
      v.literal("PAID"),
      v.literal("UNPAID"),
      v.literal("PARTIAL_PAID")
    ),
    amountPaid: v.optional(v.number()),
    balanceAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireElevated(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");

    await ctx.db.patch(args.id, {
      paymentStatus: args.paymentStatus,
      amountPaid: args.amountPaid,
      balanceAmount: args.balanceAmount,
    });
  },
});

export const approve = mutation({
  args: { id: v.id("bills") },
  handler: async (ctx, args) => {
    const { orgId } = await requireElevated(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");
    await ctx.db.patch(args.id, { status: "APPROVED" });
  },
});

export const reject = mutation({
  args: { id: v.id("bills") },
  handler: async (ctx, args) => {
    const { orgId } = await requireElevated(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");
    await ctx.db.patch(args.id, { status: "REJECTED" });
  },
});

export const remove = mutation({
  args: { id: v.id("bills") },
  handler: async (ctx, args) => {
    const { orgId, role, clerkUserId } = await requireOrgMember(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");

    if (role === "MEMBER") {
      if (bill.createdBy !== clerkUserId) throw new Error("Forbidden");
      if (bill.status === "APPROVED") {
        throw new Error("Cannot delete an approved bill");
      }
    }

    await ctx.db.delete(args.id);
  },
});

export const backfillCustomerSnapshots = mutation({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAdmin(ctx);
    const bills = await ctx.db
      .query("bills")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const customers = await ctx.db
      .query("customers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    const customerMap = new Map(customers.map((c) => [c._id, c]));

    let updated = 0;
    for (const bill of bills) {
      if (bill.customerName) continue;
      const customer = customerMap.get(bill.customerId as any);
      if (!customer) continue;
      await ctx.db.patch(bill._id, {
        customerName: customer.name,
        customerMobile: customer.mobile,
        customerLocation: customer.location,
        customerState: customer.state,
      });
      updated++;
    }

    return { updated, total: bills.length };
  },
});
