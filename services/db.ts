import { Customer, Bill, Settings } from "../types";
import { defaultSettings, mockCustomers, generateMockBills } from "../data/mockData";

const SETTINGS_KEY = "farmer_tracker_settings";
const CUSTOMERS_KEY = "farmer_tracker_customers";
const BILLS_KEY = "farmer_tracker_bills";

const isBrowser = () => typeof window !== "undefined";

export const initializeDB = () => {
  if (!isBrowser()) return;
  
  if (!localStorage.getItem(SETTINGS_KEY)) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
  }
  
  if (!localStorage.getItem(CUSTOMERS_KEY)) {
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(mockCustomers));
  }
  
  if (!localStorage.getItem(BILLS_KEY)) {
    const bills = generateMockBills(mockCustomers);
    localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
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
    paymentStatus: b.paymentStatus || "UNPAID"
  }));
};

export const saveDBBills = (bills: Bill[]) => {
  if (!isBrowser()) return;
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
};
