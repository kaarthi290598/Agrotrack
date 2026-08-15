import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./authHelpers";
import { maxUsedInvoiceSequence } from "./invoiceSequence";

const billStatus = v.union(
  v.literal("APPROVED"),
  v.literal("PENDING_APPROVAL"),
  v.literal("REJECTED"),
  v.literal("IN_PROGRESS")
);

const paymentStatus = v.union(
  v.literal("PAID"),
  v.literal("UNPAID"),
  v.literal("PARTIAL_PAID")
);
const paymentMode = v.union(v.literal("CASH"), v.literal("ONLINE"));

function inDateRange(
  dateYmd: string,
  startDate?: string,
  endDate?: string
): boolean {
  if (!dateYmd) return false;
  if (startDate && dateYmd < startDate) return false;
  if (endDate && dateYmd > endDate) return false;
  return true;
}

/**
 * Admin-only org snapshot for manual backup.
 * Optional startDate/endDate (YYYY-MM-DD) filter bills by invoice/billing date.
 * Customers: only those referenced by included bills (not by registration date).
 * Settings always included. Ordered: customers by createdAt, bills by createdAt.
 */
export const exportData = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAdmin(ctx);
    const startDate = args.startDate?.trim() || undefined;
    const endDate = args.endDate?.trim() || undefined;
    const hasRange = Boolean(startDate || endDate);

    const allCustomers = await ctx.db
      .query("customers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const allBills = await ctx.db
      .query("bills")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const bills = hasRange
      ? allBills.filter((b) => inDateRange(b.date || "", startDate, endDate))
      : allBills;
    bills.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    const billCustomerIds = new Set(bills.map((b) => b.customerId));
    const customers = (
      hasRange
        ? allCustomers.filter((c) => billCustomerIds.has(c._id))
        : allCustomers
    ).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    return {
      exportedAt: Date.now(),
      orgId,
      startDate: startDate ?? "",
      endDate: endDate ?? "",
      customers: customers.map((c) => ({
        id: c._id,
        name: c.name,
        mobile: c.mobile,
        location: c.location ?? "",
        state: c.state ?? "",
        pincode: c.pincode ?? "",
        notes: c.notes ?? "",
        createdAt: c.createdAt,
      })),
      bills: bills.map((b) => ({
        id: b._id,
        invoiceNumber: b.invoiceNumber ?? "",
        ertNumber: b.ertNumber ?? "",
        customerId: b.customerId,
        customerName: b.customerName ?? "",
        customerMobile: b.customerMobile ?? "",
        customerLocation: b.customerLocation ?? "",
        customerState: b.customerState ?? "",
        date: b.date,
        endDate: b.endDate ?? b.date ?? "",
        startTime: b.startTime ?? "",
        endTime: b.endTime ?? "",
        hoursUsed: b.hoursUsed,
        hourlyRate: b.hourlyRate,
        extraCharges: b.extraCharges,
        discount: b.discount,
        grandTotal: b.grandTotal,
        status: b.status,
        paymentStatus: b.paymentStatus,
        paymentMode: b.paymentMode ?? "",
        amountPaid: b.amountPaid ?? "",
        balanceAmount: b.balanceAmount ?? "",
        createdBy: b.createdBy ?? "",
        createdByEmail: b.createdByEmail ?? "",
        createdAt: b.createdAt,
        outsideTamilNadu: Boolean(b.outsideTamilNadu),
        activityLog: b.activityLog ?? [],
      })),
      settings: settings
        ? {
            hourlyRate: settings.hourlyRate,
            businessName: settings.businessName,
            businessAddress: settings.businessAddress,
            phoneNumber: settings.phoneNumber,
            gstNumber: settings.gstNumber ?? "",
            invoicePrefix: settings.invoicePrefix,
            nextInvoiceNumber: settings.nextInvoiceNumber ?? 1,
            invoiceNumberDigits: settings.invoiceNumberDigits ?? 5,
            currencySymbol: settings.currencySymbol,
            defaultTax: settings.defaultTax,
            invoiceNotes: settings.invoiceNotes ?? "",
            footerText: settings.footerText ?? "",
            hsnCode: settings.hsnCode ?? "",
          }
        : null,
    };
  },
});

/**
 * Admin-only restore: replaces org customers & bills, upserts settings.
 * Remaps bill.customerId using exported customer ids → newly inserted ids.
 */
export const restoreData = mutation({
  args: {
    customers: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        mobile: v.string(),
        location: v.optional(v.string()),
        state: v.optional(v.string()),
        pincode: v.optional(v.string()),
        notes: v.optional(v.string()),
        createdAt: v.number(),
      })
    ),
    bills: v.array(
      v.object({
        id: v.optional(v.string()),
        invoiceNumber: v.optional(v.string()),
        ertNumber: v.optional(v.string()),
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
        status: billStatus,
        paymentStatus: paymentStatus,
        paymentMode: v.optional(paymentMode),
        amountPaid: v.optional(v.number()),
        balanceAmount: v.optional(v.number()),
        createdBy: v.optional(v.string()),
        createdByEmail: v.optional(v.string()),
        createdAt: v.number(),
        outsideTamilNadu: v.optional(v.boolean()),
        activityLog: v.optional(
          v.array(
            v.object({
              at: v.number(),
              byName: v.string(),
              byUserId: v.optional(v.string()),
              action: v.union(
                v.literal("CREATED"),
                v.literal("UPDATED"),
                v.literal("APPROVED"),
                v.literal("REJECTED"),
                v.literal("PAYMENT_UPDATED")
              ),
            })
          )
        ),
      })
    ),
    settings: v.optional(
      v.object({
        hourlyRate: v.number(),
        businessName: v.string(),
        businessAddress: v.string(),
        phoneNumber: v.string(),
        gstNumber: v.optional(v.string()),
        invoicePrefix: v.string(),
        nextInvoiceNumber: v.optional(v.number()),
        invoiceNumberDigits: v.optional(v.number()),
        currencySymbol: v.string(),
        defaultTax: v.number(),
        invoiceNotes: v.optional(v.string()),
        footerText: v.optional(v.string()),
        hsnCode: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAdmin(ctx);

    if (args.customers.length === 0 && args.bills.length === 0) {
      throw new Error(
        "Backup has no customers or bills to restore. Settings-only import is not supported."
      );
    }
    if (args.bills.length > 0 && args.customers.length === 0) {
      throw new Error(
        "Bills require matching customers. Use a complete backup export."
      );
    }

    const existingBills = await ctx.db
      .query("bills")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const bill of existingBills) {
      await ctx.db.delete(bill._id);
    }

    const existingCustomers = await ctx.db
      .query("customers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    for (const customer of existingCustomers) {
      await ctx.db.delete(customer._id);
    }

    const idMap = new Map<string, string>();
    for (const c of args.customers) {
      const newId = await ctx.db.insert("customers", {
        orgId,
        name: c.name,
        mobile: c.mobile,
        location: emptyToUndefined(c.location),
        state: emptyToUndefined(c.state),
        pincode: emptyToUndefined(c.pincode),
        notes: emptyToUndefined(c.notes),
        createdAt: c.createdAt,
      });
      idMap.set(c.id, newId);
    }

    let billsInserted = 0;
    for (const b of args.bills) {
      const mappedCustomerId = idMap.get(b.customerId);
      if (!mappedCustomerId) {
        throw new Error(
          `Bill references unknown customerId "${b.customerId}". Export customers and bills together.`
        );
      }

      await ctx.db.insert("bills", {
        orgId,
        invoiceNumber: emptyToUndefined(b.invoiceNumber),
        ertNumber: emptyToUndefined(b.ertNumber),
        customerId: mappedCustomerId,
        customerName: emptyToUndefined(b.customerName),
        customerMobile: emptyToUndefined(b.customerMobile),
        customerLocation: emptyToUndefined(b.customerLocation),
        customerState: emptyToUndefined(b.customerState),
        date: b.date,
        endDate: emptyToUndefined(b.endDate) || b.date,
        startTime: emptyToUndefined(b.startTime),
        endTime: emptyToUndefined(b.endTime),
        hoursUsed: b.hoursUsed,
        hourlyRate: b.hourlyRate,
        extraCharges: b.extraCharges,
        discount: b.discount,
        grandTotal: b.grandTotal,
        status: b.status,
        paymentStatus: b.paymentStatus,
        paymentMode: b.paymentMode,
        amountPaid: b.amountPaid,
        balanceAmount: b.balanceAmount,
        createdBy: emptyToUndefined(b.createdBy),
        createdByEmail: emptyToUndefined(b.createdByEmail),
        createdAt: b.createdAt,
        outsideTamilNadu: Boolean(b.outsideTamilNadu),
        activityLog: b.activityLog,
      });
      billsInserted++;
    }

    if (args.settings) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .first();
      const prefix = args.settings.invoicePrefix || "INV-";
      const maxUsed = maxUsedInvoiceSequence(
        args.bills.map((b) => b.invoiceNumber),
        prefix
      );
      const requestedNext =
        typeof args.settings.nextInvoiceNumber === "number" &&
        args.settings.nextInvoiceNumber >= 1
          ? Math.floor(args.settings.nextInvoiceNumber)
          : 1;
      const settingsDoc = {
        ...args.settings,
        gstNumber: emptyToUndefined(args.settings.gstNumber),
        invoiceNotes: emptyToUndefined(args.settings.invoiceNotes),
        footerText: emptyToUndefined(args.settings.footerText),
        hsnCode: emptyToUndefined(args.settings.hsnCode),
        nextInvoiceNumber: Math.max(requestedNext, maxUsed + 1),
        invoiceNumberDigits:
          typeof args.settings.invoiceNumberDigits === "number"
            ? Math.min(8, Math.max(3, Math.floor(args.settings.invoiceNumberDigits)))
            : 5,
        orgId,
      };
      if (existing) {
        await ctx.db.patch(existing._id, settingsDoc);
      } else {
        await ctx.db.insert("settings", settingsDoc);
      }
    }

    return {
      customersDeleted: existingCustomers.length,
      billsDeleted: existingBills.length,
      customersRestored: args.customers.length,
      billsRestored: billsInserted,
      settingsRestored: Boolean(args.settings),
    };
  },
});

function emptyToUndefined(value?: string | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === "" ? undefined : trimmed;
}
