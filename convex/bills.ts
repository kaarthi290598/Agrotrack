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
type ActivityAction =
  | "CREATED"
  | "UPDATED"
  | "APPROVED"
  | "REJECTED"
  | "PAYMENT_UPDATED";

type ActivityEntry = {
  at: number;
  byName: string;
  byUserId?: string;
  action: ActivityAction;
};

function requirePaymentMode(
  paymentMode: PaymentMode | undefined
): PaymentMode {
  if (!paymentMode) {
    throw new Error("Payment Mode is required when a bill is Fully Paid");
  }
  return paymentMode;
}

/** Persist money as nearest whole rupee. */
function roundRupee(amount: number | undefined): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function roundMoneyFields<T extends {
  discount?: number;
  grandTotal?: number;
  amountPaid?: number;
  balanceAmount?: number;
  hourlyRate?: number;
  extraCharges?: { id: string; name: string; amount: number }[];
}>(fields: T): T {
  const next = { ...fields };
  if (next.discount !== undefined) next.discount = roundRupee(next.discount);
  if (next.grandTotal !== undefined) next.grandTotal = Math.max(0, roundRupee(next.grandTotal));
  if (next.amountPaid !== undefined) next.amountPaid = Math.max(0, roundRupee(next.amountPaid));
  if (next.balanceAmount !== undefined) {
    next.balanceAmount = Math.max(0, roundRupee(next.balanceAmount));
  }
  if (next.hourlyRate !== undefined) next.hourlyRate = roundRupee(next.hourlyRate);
  if (next.extraCharges) {
    next.extraCharges = next.extraCharges.map((c) => ({
      ...c,
      amount: roundRupee(c.amount),
    }));
  }
  return next;
}

async function resolveActorName(
  ctx: { db: any; auth: any },
  _orgId: string,
  clerkUserId: string,
  userId: string
): Promise<{ byName: string; byUserId: string }> {
  const user = await ctx.db.get(userId);
  const identity = await ctx.auth.getUserIdentity();
  const byName =
    (user?.fullName && String(user.fullName).trim()) ||
    (identity?.name && String(identity.name).trim()) ||
    (identity?.email && String(identity.email).trim()) ||
    clerkUserId;
  return { byName, byUserId: clerkUserId };
}

/** Bills store display name in createdBy; ownership must not compare that to clerkUserId alone. */
async function assertSupervisorCanModifyBill(
  ctx: { db: any; auth: any },
  bill: Doc<"bills">,
  role: string,
  clerkUserId: string,
  userId: string,
  orgId: string
): Promise<void> {
  if (role !== "SUPERVISOR") return;

  if (bill.status === "APPROVED") {
    throw new Error("Supervisors cannot edit approved bills");
  }

  const created = (bill.activityLog || []).find((e) => e.action === "CREATED");
  if (created?.byUserId && created.byUserId === clerkUserId) return;
  if (bill.createdBy === clerkUserId) return;

  const identity = await ctx.auth.getUserIdentity();
  const email = (identity?.email || "").toLowerCase().trim();
  const billEmail = (bill.createdByEmail || "").toLowerCase().trim();
  if (email && billEmail && email === billEmail) return;

  const actor = await resolveActorName(ctx, orgId, clerkUserId, userId);
  const billName = (bill.createdBy || "").toLowerCase().trim();
  const actorName = actor.byName.toLowerCase().trim();
  if (billName && actorName && billName === actorName) return;
  if (email && billName && billName === email) return;

  // Legacy rows with no creator identity — allow edit.
  if (!bill.createdBy && !bill.createdByEmail && !created?.byUserId) return;

  throw new Error("Forbidden");
}

function withActivity(
  existing: ActivityEntry[] | undefined,
  entry: ActivityEntry
): ActivityEntry[] {
  return [...(existing || []), entry];
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
    endDate: v.optional(v.string()),
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
    const { orgId, clerkUserId, role, userId } = await requireOrgMember(ctx);
    const ertNumber = normalizeAndValidateErt(args.ertNumber);
    await assertErtUnique(ctx, orgId, ertNumber);

    // Only Fully Paid bills may be Approved; supervisors cannot self-approve.
    let status = args.status;
    if (args.paymentStatus !== "PAID" && status === "APPROVED") {
      status = "PENDING_APPROVAL";
    }
    if (role === "SUPERVISOR" && status === "APPROVED") {
      status = "PENDING_APPROVAL";
    }
    const paymentMode =
      args.paymentStatus === "PAID"
        ? requirePaymentMode(args.paymentMode)
        : undefined;

    const actor = await resolveActorName(ctx, orgId, clerkUserId, userId);
    const now = Date.now();
    const { ertNumber: _ert, paymentMode: _paymentMode, ...rest } = args;
    const money = roundMoneyFields(rest);
    const billId = await ctx.db.insert("bills", {
      ...money,
      endDate: args.endDate || args.date,
      ertNumber,
      paymentMode,
      status,
      orgId,
      createdBy: args.createdBy || clerkUserId,
      createdAt: now,
      activityLog: [
        {
          at: now,
          byName: actor.byName,
          byUserId: actor.byUserId,
          action: "CREATED",
        },
      ],
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
    endDate: v.optional(v.string()),
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
    const { orgId, role, clerkUserId, userId } = await requireOrgMember(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");

    await assertSupervisorCanModifyBill(
      ctx,
      bill,
      role,
      clerkUserId,
      userId,
      orgId
    );

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
    if (
      resultingPaymentStatus !== "PAID" &&
      (fields.status === "APPROVED" ||
        (fields.status === undefined && bill.status === "APPROVED"))
    ) {
      // Keep approved unpaid legacy rows as-is unless status is being set;
      // block newly setting APPROVED without payment.
      if (fields.status === "APPROVED") {
        fields.status = "PENDING_APPROVAL";
      }
    }
    fields.paymentMode =
      resultingPaymentStatus === "PAID"
        ? requirePaymentMode(fields.paymentMode ?? bill.paymentMode)
        : undefined;

    const actor = await resolveActorName(ctx, orgId, clerkUserId, userId);
    const activityLog = withActivity(bill.activityLog, {
      at: Date.now(),
      byName: actor.byName,
      byUserId: actor.byUserId,
      action: "UPDATED",
    });

    // Never allow clients to set/change invoiceNumber via update args
    await ctx.db.patch(id, { ...roundMoneyFields(fields), activityLog });

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
    const { orgId, clerkUserId, userId } = await requireElevated(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");

    const paymentMode =
      args.paymentStatus === "PAID"
        ? requirePaymentMode(args.paymentMode)
        : undefined;
    const actor = await resolveActorName(ctx, orgId, clerkUserId, userId);
    const money = roundMoneyFields({
      amountPaid: args.amountPaid,
      balanceAmount: args.balanceAmount,
    });
    await ctx.db.patch(args.id, {
      paymentStatus: args.paymentStatus,
      paymentMode,
      amountPaid: money.amountPaid,
      balanceAmount: money.balanceAmount,
      activityLog: withActivity(bill.activityLog, {
        at: Date.now(),
        byName: actor.byName,
        byUserId: actor.byUserId,
        action: "PAYMENT_UPDATED",
      }),
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
    const { orgId, clerkUserId, userId } = await requireElevated(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");
    if (bill.paymentStatus !== "PAID") {
      throw new Error("Only Fully Paid invoices can be approved");
    }
    const actor = await resolveActorName(ctx, orgId, clerkUserId, userId);
    await ctx.db.patch(args.id, {
      status: "APPROVED",
      activityLog: withActivity(bill.activityLog, {
        at: Date.now(),
        byName: actor.byName,
        byUserId: actor.byUserId,
        action: "APPROVED",
      }),
    });
  },
});

export const reject = mutation({
  args: { id: v.id("bills") },
  handler: async (ctx, args) => {
    const { orgId, clerkUserId, userId } = await requireElevated(ctx);
    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");
    assertSameOrg(bill.orgId, orgId, "Bill");
    if (bill.paymentStatus !== "PAID") {
      throw new Error("Only Fully Paid invoices can be rejected");
    }
    const actor = await resolveActorName(ctx, orgId, clerkUserId, userId);
    await ctx.db.patch(args.id, {
      status: "REJECTED",
      activityLog: withActivity(bill.activityLog, {
        at: Date.now(),
        byName: actor.byName,
        byUserId: actor.byUserId,
        action: "REJECTED",
      }),
    });
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
