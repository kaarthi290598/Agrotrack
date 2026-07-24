import { Settings } from "../types";
import { getDBSettings, saveDBSettings } from "./db";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://different-puffin-360.convex.cloud";
const convex = new ConvexHttpClient(convexUrl);

export const settingsService = {
  get: async (orgId?: string): Promise<Settings> => {
    try {
      const data = await convex.query(api.settings.get, { orgId });
      const settings: Settings = {
        hourlyRate: data.hourlyRate,
        businessName: data.businessName,
        businessAddress: data.businessAddress,
        phoneNumber: data.phoneNumber,
        gstNumber: data.gstNumber,
        invoicePrefix: data.invoicePrefix,
        currencySymbol: data.currencySymbol,
        defaultTax: data.defaultTax,
        invoiceNotes: data.invoiceNotes,
        footerText: data.footerText,
      };
      return settings;
    } catch (e) {
      console.warn("Falling back to local DB for settings:", e);
      return getDBSettings();
    }
  },

  update: async (settings: Settings, orgId?: string): Promise<Settings> => {
    try {
      await convex.mutation(api.settings.update, { ...settings, orgId });
      saveDBSettings(settings);
      return settings;
    } catch (e) {
      console.warn("Convex settings update fallback:", e);
      saveDBSettings(settings);
      return settings;
    }
  },
};
