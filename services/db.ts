import { Customer, Bill, Settings } from "../types";
import { defaultSettings } from "../data/mockData";

const SETTINGS_KEY = "farmer_tracker_settings";
const CUSTOMERS_KEY = "farmer_tracker_customers";
const BILLS_KEY = "farmer_tracker_bills";
const PURGED_MOCK_KEY = "farmer_tracker_mock_purged_v1";

const isBrowser = () => typeof window !== "undefined";

/** One-time purge of legacy localStorage mock seed (Rajesh Gowda / 50 fake bills). */
function purgeLegacyMockIfNeeded() {
  if (!isBrowser()) return;
  if (localStorage.getItem(PURGED_MOCK_KEY)) return;

  try {
    const customersRaw = localStorage.getItem(CUSTOMERS_KEY);
    const billsRaw = localStorage.getItem(BILLS_KEY);
    const customers = customersRaw ? JSON.parse(customersRaw) : [];
    const bills = billsRaw ? JSON.parse(billsRaw) : [];

    const looksLikeMockCustomers =
      Array.isArray(customers) &&
      customers.some(
        (c: Customer) =>
          String(c.id || "").startsWith("cust-") ||
          c.name === "Rajesh Gowda" ||
          String(c.name || "").includes("(Org ")
      );

    const looksLikeMockBills =
      Array.isArray(bills) &&
      bills.some(
        (b: Bill) =>
          String(b.id || "").startsWith("bill-") ||
          String(b.createdByEmail || "").includes("demo.com")
      );

    if (looksLikeMockCustomers) {
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify([]));
    }
    if (looksLikeMockBills) {
      localStorage.setItem(BILLS_KEY, JSON.stringify([]));
    }

    const settingsRaw = localStorage.getItem(SETTINGS_KEY);
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw) as Settings;
      if (
        settings.businessName === "Agro Track Machinery Services" ||
        settings.businessName === "Arkit Innovatives Services" ||
        String(settings.businessName || "").includes("(Org ")
      ) {
        localStorage.setItem(
          SETTINGS_KEY,
          JSON.stringify({
            ...defaultSettings,
            businessName: "My Business",
            businessAddress: "",
            phoneNumber: "",
            gstNumber: "",
            invoiceNotes: "",
            footerText: "",
          })
        );
      }
    }
  } catch {
    // ignore corrupt local cache
  }

  localStorage.setItem(PURGED_MOCK_KEY, "1");
}

export const initializeDB = () => {
  if (!isBrowser()) return;

  purgeLegacyMockIfNeeded();

  // Only ensure keys exist — never inject demo/mock customers or bills
  if (!localStorage.getItem(SETTINGS_KEY)) {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        ...defaultSettings,
        businessName: "My Business",
        businessAddress: "",
        phoneNumber: "",
        gstNumber: "",
        invoiceNotes: "",
        footerText: "",
      })
    );
  }

  if (!localStorage.getItem(CUSTOMERS_KEY)) {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify([]));
  }

  if (!localStorage.getItem(BILLS_KEY)) {
    localStorage.setItem(BILLS_KEY, JSON.stringify([]));
  }
};

export const getDBSettings = (): Settings => {
  if (!isBrowser()) return defaultSettings;
  initializeDB();
  const data = localStorage.getItem(SETTINGS_KEY);
  return data ? JSON.parse(data) : defaultSettings;
};

export const saveDBSettings = (settings: Settings) => {
  if (!isBrowser()) return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getDBCustomers = (): Customer[] => {
  if (!isBrowser()) return [];
  initializeDB();
  const data = localStorage.getItem(CUSTOMERS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveDBCustomers = (customers: Customer[]) => {
  if (!isBrowser()) return;
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
};

export const getDBBills = (): Bill[] => {
  if (!isBrowser()) return [];
  initializeDB();
  const data = localStorage.getItem(BILLS_KEY);
  if (!data) return [];
  const bills: Bill[] = JSON.parse(data);
  return bills.map((b) => ({
    ...b,
    status: b.status || "APPROVED",
    paymentStatus: b.paymentStatus || "UNPAID",
  }));
};

export const saveDBBills = (bills: Bill[]) => {
  if (!isBrowser()) return;
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
};
