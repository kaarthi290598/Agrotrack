import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireOrgMember, requireAdmin } from "./authHelpers";
import {
  formatInvoiceNumber,
  maxUsedInvoiceSequence,
  normalizeInvoiceDigits,
  DEFAULT_INVOICE_NUMBER_DIGITS,
} from "./invoiceSequence";

const defaultSettings = {
  hourlyRate: 1200,
  businessName: "My Business",
  businessAddress: "",
  phoneNumber: "",
  gstNumber: "",
  invoicePrefix: "INV-",
  nextInvoiceNumber: 1,
  invoiceNumberDigits: DEFAULT_INVOICE_NUMBER_DIGITS,
  highestUsedInvoiceNumber: 0,
  latestInvoiceNumber: null as string | null,
  currencySymbol: "₹",
  defaultTax: 0,
  invoiceNotes: "",
  footerText: "",
  hsnCode: "",
  logoUrl: null as string | null,
  logoStorageId: undefined as string | undefined,
  signatureUrl: null as string | null,
  signatureStorageId: undefined as string | undefined,
};

async function highestUsedForPrefix(
  ctx: { db: any },
  orgId: string,
  prefix: string
): Promise<number> {
  const orgBills = await ctx.db
    .query("bills")
    .withIndex("by_org", (q: any) => q.eq("orgId", orgId))
    .collect();
  return maxUsedInvoiceSequence(
    orgBills.map((b: { invoiceNumber?: string }) => b.invoiceNumber),
    prefix
  );
}

async function findBillByInvoiceNumber(
  ctx: { db: any },
  orgId: string,
  invoiceNumber: string
) {
  return await ctx.db
    .query("bills")
    .withIndex("by_org_invoiceNumber", (q: any) =>
      q.eq("orgId", orgId).eq("invoiceNumber", invoiceNumber)
    )
    .first();
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireOrgMember(ctx);
    const settings = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (!settings) return defaultSettings;

    const prefix = settings.invoicePrefix || "INV-";
    const digits = normalizeInvoiceDigits(settings.invoiceNumberDigits);
    const highestUsed = await highestUsedForPrefix(ctx, orgId, prefix);
    const storedNext = settings.nextInvoiceNumber;
    const nextInvoiceNumber =
      typeof storedNext === "number" && storedNext >= 1
        ? Math.max(storedNext, highestUsed + 1)
        : highestUsed + 1 || 1;

    const logoUrl = settings.logoStorageId
      ? await ctx.storage.getUrl(settings.logoStorageId)
      : null;
    const signatureUrl = settings.signatureStorageId
      ? await ctx.storage.getUrl(settings.signatureStorageId)
      : null;

    return {
      hourlyRate: settings.hourlyRate,
      businessName: settings.businessName,
      businessAddress: settings.businessAddress,
      phoneNumber: settings.phoneNumber,
      gstNumber: settings.gstNumber ?? "",
      invoicePrefix: prefix,
      nextInvoiceNumber,
      invoiceNumberDigits: digits,
      highestUsedInvoiceNumber: highestUsed,
      latestInvoiceNumber:
        highestUsed > 0
          ? formatInvoiceNumber(prefix, highestUsed, digits)
          : null,
      currencySymbol: settings.currencySymbol,
      defaultTax: settings.defaultTax,
      invoiceNotes: settings.invoiceNotes ?? "",
      footerText: settings.footerText ?? "",
      hsnCode: settings.hsnCode ?? "",
      logoUrl,
      logoStorageId: settings.logoStorageId,
      signatureUrl,
      signatureStorageId: settings.signatureStorageId,
    };
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
    nextInvoiceNumber: v.number(),
    invoiceNumberDigits: v.number(),
    currencySymbol: v.string(),
    defaultTax: v.number(),
    invoiceNotes: v.optional(v.string()),
    footerText: v.optional(v.string()),
    hsnCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    const prefix = String(args.invoicePrefix || "").trim() || "INV-";
    const digits = normalizeInvoiceDigits(args.invoiceNumberDigits);
    const next = Math.floor(Number(args.nextInvoiceNumber));
    if (!Number.isFinite(next) || next < 1) {
      throw new Error("Next invoice number must be a positive integer.");
    }
    if (String(next).length > digits) {
      throw new Error(
        `Next invoice number ${next} needs more than ${digits} digits. Increase digit count.`
      );
    }

    const highestUsed = await highestUsedForPrefix(ctx, orgId, prefix);
    const minAllowed = highestUsed + 1;
    if (next < minAllowed) {
      throw new Error(
        `Next invoice number must be at least ${minAllowed} (highest used under "${prefix}" is ${highestUsed || "none"}).`
      );
    }

    const candidate = formatInvoiceNumber(prefix, next, digits);
    const duplicate = await findBillByInvoiceNumber(ctx, orgId, candidate);
    if (duplicate) {
      throw new Error(
        `Invoice number ${candidate} already exists. Choose a higher next number.`
      );
    }

    const {
      hsnCode,
      gstNumber,
      invoiceNotes,
      footerText,
      invoicePrefix: _prefix,
      nextInvoiceNumber: _next,
      invoiceNumberDigits: _digits,
      ...rest
    } = args;

    const patch = {
      ...rest,
      orgId,
      invoicePrefix: prefix,
      nextInvoiceNumber: next,
      invoiceNumberDigits: digits,
      gstNumber: gstNumber || undefined,
      invoiceNotes: invoiceNotes || undefined,
      footerText: footerText || undefined,
      hsnCode: hsnCode || undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("settings", patch);
    }
  },
});

export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setLogo = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (existing?.logoStorageId && existing.logoStorageId !== args.storageId) {
      try {
        await ctx.storage.delete(existing.logoStorageId);
      } catch {
        // Ignore missing previous file
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, { logoStorageId: args.storageId, orgId });
    } else {
      await ctx.db.insert("settings", {
        hourlyRate: defaultSettings.hourlyRate,
        businessName: defaultSettings.businessName,
        businessAddress: defaultSettings.businessAddress,
        phoneNumber: defaultSettings.phoneNumber,
        invoicePrefix: defaultSettings.invoicePrefix,
        nextInvoiceNumber: defaultSettings.nextInvoiceNumber,
        invoiceNumberDigits: defaultSettings.invoiceNumberDigits,
        currencySymbol: defaultSettings.currencySymbol,
        defaultTax: defaultSettings.defaultTax,
        logoStorageId: args.storageId,
        orgId,
      });
    }

    return { logoUrl: await ctx.storage.getUrl(args.storageId) };
  },
});

export const clearLogo = mutation({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (!existing) return;

    if (existing.logoStorageId) {
      try {
        await ctx.storage.delete(existing.logoStorageId);
      } catch {
        // Ignore missing file
      }
    }

    await ctx.db.patch(existing._id, { logoStorageId: undefined });
  },
});

export const generateSignatureUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setSignature = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const { orgId } = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (
      existing?.signatureStorageId &&
      existing.signatureStorageId !== args.storageId
    ) {
      try {
        await ctx.storage.delete(existing.signatureStorageId);
      } catch {
        // Ignore missing previous file
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        signatureStorageId: args.storageId,
        orgId,
      });
    } else {
      await ctx.db.insert("settings", {
        hourlyRate: defaultSettings.hourlyRate,
        businessName: defaultSettings.businessName,
        businessAddress: defaultSettings.businessAddress,
        phoneNumber: defaultSettings.phoneNumber,
        invoicePrefix: defaultSettings.invoicePrefix,
        nextInvoiceNumber: defaultSettings.nextInvoiceNumber,
        invoiceNumberDigits: defaultSettings.invoiceNumberDigits,
        currencySymbol: defaultSettings.currencySymbol,
        defaultTax: defaultSettings.defaultTax,
        signatureStorageId: args.storageId,
        orgId,
      });
    }

    return { signatureUrl: await ctx.storage.getUrl(args.storageId) };
  },
});

export const clearSignature = mutation({
  args: {},
  handler: async (ctx) => {
    const { orgId } = await requireAdmin(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();

    if (!existing) return;

    if (existing.signatureStorageId) {
      try {
        await ctx.storage.delete(existing.signatureStorageId);
      } catch {
        // Ignore missing file
      }
    }

    await ctx.db.patch(existing._id, { signatureStorageId: undefined });
  },
});
