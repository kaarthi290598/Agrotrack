import { Settings } from "../types";
import { getDBSettings, saveDBSettings } from "./db";
import { api } from "../convex/_generated/api";
import { getAuthedConvexClient } from "../lib/convex-client";

export const settingsService = {
  get: async (_orgId?: string): Promise<Settings> => {
    const convex = await getAuthedConvexClient();
    const data = await convex.query(api.settings.get, {});
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
    saveDBSettings(settings);
    return settings;
  },

  update: async (settings: Settings, _orgId?: string): Promise<Settings> => {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.settings.update, { ...settings });
    saveDBSettings(settings);
    return settings;
  },
};
