import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  requireOrgMember,
  requireElevated,
  requireAdmin,
  assertSameOrg,
} from "./authHelpers";
import {
  formatInvoiceNumber,
  maxUsedInvoiceSequence,
  normalizeInvoiceDigits,
} from "./invoiceSequence";

const ERT_PATTERN = /^[A-Za-z0-9-]+$/;
const paymentModeValidator = v.union(
  v.literal("CASH"),
  v.literal("ONLINE")
);

type PaymentMode = "CASH" | "ONLINE";

function requirePaymentMode(
  paymentMode: PaymentMode | undefined
): PaymentMode {
  if (!paymentMode) {
    throw new Error("Payment Mode is required when a bill is Fully Paid");
  }
  return paymentMode;
}

function normalizeAndValidateErt(raw: string): string {
  const ertNumber = String(raw || "").trim().toUpperCase();
  if (!ertNumber) {
    throw new Error("ERT Number is required");
  }
  if (!ERT_PATTERN.test(ertNumber)) {
    throw new Error(
      "ERT Number may only contain letters, digits, and dashes"
    );
  }
  return ertNumber;
}

async function assertErtUnique(
  ctx: { db: any },
  orgId: string,
  ertNumber: string,
  excludeBillId?: Id<"bills">
): Promise<void> {
  const exact = await ctx.db
    .query("bills")
    .withIndex("by_org_ertNumber", (q: any) =>
      q.eq("orgId", orgId).eq("ertNumber", ertNumber)
    )
    .first();
  if (exact && exact._id !== excludeBillId) {
    throw new Error(
      `ERT Number "${ertNumber}" is already used on another bill.`
    );
  }

  // Catch legacy mixed-case rows that predate uppercase normalization.
  const orgBills = await ctx.db
    .query("bills")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();
  const lower = ertNumber.toLowerCase();
  const legacyDup = orgBills.find(
    (b: Doc<"bills">) =>
      b._id !== excludeBillId &&
      b.ertNumber &&
      b.ertNumber.toLowerCase() === lower
  );
  if (legacyDup) {
    throw new Error(
      `ERT Number "${ertNumber}" is already used on another bill.`
    );
  }
}

/**
 * Assign the next invoice number once when the bill is Fully Paid.
 * Never regenerates or overwrites an existing invoiceNumber.
 */
async function assignInvoiceNumberIfNeeded(
  ctx: { db: any },
  orgId: string,
  billId: Id<"bills">,
  bill: Doc<"bills"> | null
): Promise<string | undefined> {
  if (!bill) return undefined;
  if (bill.invoiceNumber) return bill.invoiceNumber;
  if (bill.paymentStatus !== "PAID") return undefined;

  const settings = await ctx.db
    .query("settings")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .first();
  const prefix = settings?.invoicePrefix || "INV-";
  const digits = normalizeInvoiceDigits(settings?.invoiceNumberDigits);

  const orgBills = await ctx.db
    .query("bills")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();

  const maxUsed = maxUsedInvoiceSequence(
    orgBills.map((b: { invoiceNumber?: string }) => b.invoiceNumber),
    prefix
  );
  const storedNext =
    typeof settings?.nextInvoiceNumber === "number" &&
    settings.nextInvoiceNumber >= 1
      ? settings.nextInvoiceNumber
      : 1;
  const n = Math.max(storedNext, maxUsed + 1);
  if (String(n).length > digits) {
    throw new Error(
      `Invoice sequence ${n} exceeds ${digits}-digit width. Increase digit count in Settings.`
    );
  }
  const invoiceNumber = formatInvoiceNumber(prefix, n, digits);

  const duplicate = await ctx.db
    .query("bills")
    .withIndex("by_org_invoiceNumber", (q: any) =>
      q.eq("orgId", orgId).eq("invoiceNumber", invoiceNumber)
    )
    .first();
  if (duplicate) {
    throw new Error(
      `Invoice number ${invoiceNumber} already exists. Update Next Invoice Number in Settings.`
    );
  }

  await ctx.db.patch(billId, { invoiceNumber });

  if (settings) {
    await ctx.db.patch(settings._id, { nextInvoiceNumber: n + 1 });
  } else {
    await ctx.db.insert("settings", {
      orgId,
      hourlyRate: 1200,
      businessName: "My Business",
      businessAddress: "",
      phoneNumber: "",
      invoicePrefix: prefix,
      nextInvoiceNumber: n + 1,
      invoiceNumberDigits: digits,
      currencySymbol: "₹",
      defaultTax: 0,
    });
  }

  return invoiceNumber;
}

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
    ertNumber: v.string(),
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
    paymentMode: v.optional(paymentModeValidator),
    amountPaid: v.optional(v.number()),
    balanceAmount: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    createdByEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId, clerkUserId, role } = await requireOrgMember(ctx);
    const ertNumber = normalizeAndValidateErt(args.ertNumber);
    await assertErtUnique(ctx, orgId, ertNumber);

    // Supervisors (basic role) cannot self-approve
    let status = args.status;
    if (role === "SUPERVISOR" && status === "APPROVED") {
      status = "PENDING_APPROVAL";
    }
    const paymentMode =
      args.paymentStatus === "PAID"
        ? requirePaymentMode(args.paymentMode)
        : undefined;

    const { ertNumber: _ert, paymentMode: _paymentMode, ...rest } = args;
    const billId = await ctx.db.insert("bills", {
      ...rest,
      ertNumber,
      paymentMode,
      status,
      orgId,
      createdBy: args.createdBy || clerkUserId,
      createdAt: Date.now(),
    });

    let invoiceNumber: string | undefined;
    if (args.paymentStatus === "PAID") {
      const bill = await ctx.db.get(billId);
      invoiceNumber = await assignInvoiceNumberIfNeeded(
        ctx,
        orgId,
        billId,
        bill
      );
    }

    return { id: billId, invoiceNumber, ertNumber };
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
    ertNumber: v.optional(v.string()),
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
    paymentMode: v.optional(paymentModeValidator),
    amountPaid: v.optional(v.number()),
    balanceAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { orgId, role, clerkUserId } = await requireOrgMember(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");

    if (role === "SUPERVISOR" && bill.createdBy && bill.createdBy !== clerkUserId) {
      throw new Error("Forbidden");
    }

    const { id, ...fields } = args;
    if (role === "SUPERVISOR" && fields.status === "APPROVED") {
      fields.status = "PENDING_APPROVAL";
    }

    // ERT required on save: use provided value or keep existing; reject empty.
    if (fields.ertNumber !== undefined) {
      fields.ertNumber = normalizeAndValidateErt(fields.ertNumber);
      await assertErtUnique(ctx, orgId, fields.ertNumber, id);
    } else if (!bill.ertNumber) {
      throw new Error("ERT Number is required");
    }

    const resultingPaymentStatus =
      fields.paymentStatus ?? bill.paymentStatus;
    fields.paymentMode =
      resultingPaymentStatus === "PAID"
        ? requirePaymentMode(fields.paymentMode ?? bill.paymentMode)
        : undefined;

    // Never allow clients to set/change invoiceNumber via update args
    await ctx.db.patch(id, fields);

    const updated = await ctx.db.get(id);
    const invoiceNumber = await assignInvoiceNumberIfNeeded(
      ctx,
      orgId,
      id,
      updated
    );

    return {
      id,
      invoiceNumber: invoiceNumber ?? updated?.invoiceNumber,
      ertNumber: updated?.ertNumber,
      paymentMode: updated?.paymentMode,
    };
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
    paymentMode: v.optional(paymentModeValidator),
    amountPaid: v.optional(v.number()),
    balanceAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireElevated(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");

    const paymentMode =
      args.paymentStatus === "PAID"
        ? requirePaymentMode(args.paymentMode)
        : undefined;
    await ctx.db.patch(args.id, {
      paymentStatus: args.paymentStatus,
      paymentMode,
      amountPaid: args.amountPaid,
      balanceAmount: args.balanceAmount,
    });

    const updated = await ctx.db.get(args.id);
    const invoiceNumber = await assignInvoiceNumberIfNeeded(
      ctx,
      orgId,
      args.id,
      updated
    );

    return {
      id: args.id,
      invoiceNumber: invoiceNumber ?? updated?.invoiceNumber,
      paymentStatus: args.paymentStatus,
      paymentMode: updated?.paymentMode,
    };
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
    const { orgId } = await requireAdmin(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");

    await ctx.db.delete(args.id);
  },
});

/**
 * One-time cleanup: clear invoice numbers from unpaid/partial bills
 * so the sequence contains only paid invoices.
 */
export const clearUnpaidInvoiceNumbers = mutation({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAdmin(ctx);
    const bills = await ctx.db
      .query("bills")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    let cleared = 0;
    for (const bill of bills) {
      if (bill.paymentStatus === "PAID") continue;
      if (!bill.invoiceNumber) continue;
      await ctx.db.patch(bill._id, { invoiceNumber: undefined });
      cleared++;
    }

    return { cleared, total: bills.length };
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
