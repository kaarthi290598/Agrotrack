import { Settings } from "../types";
import { getDBSettings, saveDBSettings } from "./db";
import { api } from "../convex/_generated/api";
import { getAuthedConvexClient } from "../lib/convex-client";
import type { Id } from "../convex/_generated/dataModel";
import { blendSignatureFile } from "../lib/blend-signature";

function mapSettings(data: {
  hourlyRate: number;
  businessName: string;
  businessAddress: string;
  phoneNumber: string;
  gstNumber?: string;
  invoicePrefix: string;
  nextInvoiceNumber?: number;
  invoiceNumberDigits?: number;
  highestUsedInvoiceNumber?: number;
  latestInvoiceNumber?: string | null;
  currencySymbol: string;
  defaultTax: number;
  invoiceNotes?: string;
  footerText?: string;
  hsnCode?: string;
  logoUrl?: string | null;
  logoStorageId?: string;
  signatureUrl?: string | null;
  signatureStorageId?: string;
}): Settings {
  return {
    hourlyRate: data.hourlyRate,
    businessName: data.businessName,
    businessAddress: data.businessAddress,
    phoneNumber: data.phoneNumber,
    gstNumber: data.gstNumber || undefined,
    invoicePrefix: data.invoicePrefix,
    nextInvoiceNumber: data.nextInvoiceNumber ?? 1,
    invoiceNumberDigits: data.invoiceNumberDigits ?? 5,
    highestUsedInvoiceNumber: data.highestUsedInvoiceNumber ?? 0,
    latestInvoiceNumber: data.latestInvoiceNumber ?? null,
    currencySymbol: data.currencySymbol,
    defaultTax: data.defaultTax,
    invoiceNotes: data.invoiceNotes || undefined,
    footerText: data.footerText || undefined,
    hsnCode: data.hsnCode || undefined,
    logoUrl: data.logoUrl ?? null,
    logoStorageId: data.logoStorageId,
    signatureUrl: data.signatureUrl ?? null,
    signatureStorageId: data.signatureStorageId,
  };
}

export const settingsService = {
  get: async (_orgId?: string): Promise<Settings> => {
    const convex = await getAuthedConvexClient();
    const data = await convex.query(api.settings.get, {});
    const settings = mapSettings(data);
    saveDBSettings(settings);
    return settings;
  },

  update: async (settings: Settings, _orgId?: string): Promise<Settings> => {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.settings.update, {
      hourlyRate: settings.hourlyRate,
      businessName: settings.businessName,
      businessAddress: settings.businessAddress,
      phoneNumber: settings.phoneNumber,
      gstNumber: settings.gstNumber || undefined,
      invoicePrefix: settings.invoicePrefix,
      nextInvoiceNumber: settings.nextInvoiceNumber,
      invoiceNumberDigits: settings.invoiceNumberDigits,
      currencySymbol: settings.currencySymbol,
      defaultTax: settings.defaultTax,
      invoiceNotes: settings.invoiceNotes || undefined,
      footerText: settings.footerText || undefined,
      hsnCode: settings.hsnCode || undefined,
    });
    return await settingsService.get();
  },

  uploadLogo: async (file: File): Promise<Settings> => {
    const allowed = ["image/png", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      throw new Error("Logo must be a PNG or SVG file.");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("Logo must be 2 MB or smaller.");
    }

    const convex = await getAuthedConvexClient();
    const uploadUrl = await convex.mutation(api.settings.generateLogoUploadUrl, {});
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!result.ok) {
      throw new Error("Failed to upload logo file.");
    }
    const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
    await convex.mutation(api.settings.setLogo, { storageId });
    return await settingsService.get();
  },

  clearLogo: async (): Promise<Settings> => {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.settings.clearLogo, {});
    return await settingsService.get();
  },

  uploadSignature: async (file: File): Promise<Settings> => {
    const blended = await blendSignatureFile(file);
    const convex = await getAuthedConvexClient();
    const uploadUrl = await convex.mutation(
      api.settings.generateSignatureUploadUrl,
      {}
    );
    const result = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: blended,
    });
    if (!result.ok) {
      throw new Error("Failed to upload signature file.");
    }
    const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
    await convex.mutation(api.settings.setSignature, { storageId });
    return await settingsService.get();
  },

  clearSignature: async (): Promise<Settings> => {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.settings.clearSignature, {});
    return await settingsService.get();
  },
};
