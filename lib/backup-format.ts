/** Shared backup row shapes + CSV helpers (export/import round-trip). */

export type BackupCustomerRow = {
  id: string;
  name: string;
  mobile: string;
  location: string;
  state: string;
  pincode: string;
  notes: string;
  createdAt: number;
};

export type BackupBillRow = {
  id: string;
  invoiceNumber: string;
  ertNumber: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerLocation: string;
  customerState: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  hoursUsed: number;
  hourlyRate: number;
  extraCharges: string; // JSON
  discount: number;
  grandTotal: number;
  status: string;
  paymentStatus: string;
  paymentMode: string;
  amountPaid: string | number;
  balanceAmount: string | number;
  createdBy: string;
  createdByEmail: string;
  createdAt: number;
  outsideTamilNadu: string;
  activityLog: string; // JSON
};

export type BackupSettingsRow = {
  hourlyRate: number;
  businessName: string;
  businessAddress: string;
  phoneNumber: string;
  gstNumber: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  invoiceNumberDigits: number;
  currencySymbol: string;
  defaultTax: number;
  invoiceNotes: string;
  footerText: string;
  hsnCode: string;
};

export type BackupSnapshot = {
  exportedAt: number;
  orgId: string;
  startDate?: string;
  endDate?: string;
  customers: BackupCustomerRow[];
  bills: Array<
    Omit<BackupBillRow, "extraCharges" | "activityLog" | "outsideTamilNadu"> & {
      extraCharges: { id: string; name: string; amount: number }[];
      outsideTamilNadu?: boolean;
      activityLog?: Array<{
        at: number;
        byName: string;
        byUserId?: string;
        action:
          | "CREATED"
          | "UPDATED"
          | "APPROVED"
          | "REJECTED"
          | "PAYMENT_UPDATED";
      }>;
    }
  >;
  settings: BackupSettingsRow | null;
};

export type BackupDateFilter = {
  startDate?: string;
  endDate?: string;
};

export type RestorePayload = {
  customers: Array<{
    id: string;
    name: string;
    mobile: string;
    location?: string;
    state?: string;
    pincode?: string;
    notes?: string;
    createdAt: number;
  }>;
  bills: Array<{
    id?: string;
    invoiceNumber?: string;
    ertNumber?: string;
    customerId: string;
    customerName?: string;
    customerMobile?: string;
    customerLocation?: string;
    customerState?: string;
    date: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    hoursUsed: number;
    hourlyRate: number;
    extraCharges: { id: string; name: string; amount: number }[];
    discount: number;
    grandTotal: number;
    status: "APPROVED" | "PENDING_APPROVAL" | "REJECTED" | "IN_PROGRESS";
    paymentStatus: "PAID" | "UNPAID" | "PARTIAL_PAID";
    paymentMode?: "CASH" | "ONLINE";
    amountPaid?: number;
    balanceAmount?: number;
    createdBy?: string;
    createdByEmail?: string;
    createdAt: number;
    outsideTamilNadu?: boolean;
    activityLog?: Array<{
      at: number;
      byName: string;
      byUserId?: string;
      action: "CREATED" | "UPDATED" | "APPROVED" | "REJECTED" | "PAYMENT_UPDATED";
    }>;
  }>;
  settings?: BackupSettingsRow;
};

/** Full ZIP/Excel backup must include both entity sections before wipe-replace. */
export function assertFullBackupSections(sections: {
  hasCustomersSection: boolean;
  hasBillsSection: boolean;
  customers: unknown[];
  bills: unknown[];
}): void {
  if (!sections.hasCustomersSection || !sections.hasBillsSection) {
    throw new Error(
      "Import requires a full backup with both Customers and Bills (ZIP or Excel)."
    );
  }
  if (sections.customers.length === 0 && sections.bills.length === 0) {
    throw new Error("Backup has no customers or bills to restore.");
  }
  if (sections.bills.length > 0 && sections.customers.length === 0) {
    throw new Error(
      "Bills require matching customers. Use a complete backup export."
    );
  }
}

export const CUSTOMER_HEADERS = [
  "id",
  "name",
  "mobile",
  "location",
  "state",
  "pincode",
  "notes",
  "createdAt",
] as const;

export const BILL_HEADERS = [
  "id",
  "invoiceNumber",
  "ertNumber",
  "customerId",
  "customerName",
  "customerMobile",
  "customerLocation",
  "customerState",
  "date",
  "endDate",
  "startTime",
  "endTime",
  "hoursUsed",
  "hourlyRate",
  "extraCharges",
  "discount",
  "grandTotal",
  "status",
  "paymentStatus",
  "paymentMode",
  "amountPaid",
  "balanceAmount",
  "createdBy",
  "createdByEmail",
  "createdAt",
  "outsideTamilNadu",
  "activityLog",
] as const;

export const SETTINGS_HEADERS = [
  "hourlyRate",
  "businessName",
  "businessAddress",
  "phoneNumber",
  "gstNumber",
  "invoicePrefix",
  "nextInvoiceNumber",
  "invoiceNumberDigits",
  "currencySymbol",
  "defaultTax",
  "invoiceNotes",
  "footerText",
  "hsnCode",
] as const;

export function customersToRows(customers: BackupSnapshot["customers"]) {
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    mobile: c.mobile,
    location: c.location ?? "",
    state: c.state ?? "",
    pincode: c.pincode ?? "",
    notes: c.notes ?? "",
    createdAt: c.createdAt,
  }));
}

export function billsToRows(bills: BackupSnapshot["bills"]) {
  return bills.map((b) => ({
    id: b.id,
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
    extraCharges: JSON.stringify(b.extraCharges ?? []),
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
    outsideTamilNadu: b.outsideTamilNadu ? "true" : "false",
    activityLog: JSON.stringify(b.activityLog ?? []),
  }));
}

export function settingsToRows(settings: BackupSettingsRow | null) {
  if (!settings) return [] as Record<string, string | number>[];
  return [
    {
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
    },
  ];
}

export function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(
  headers: readonly string[],
  rows: Record<string, unknown>[]
): string {
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => escapeCsvCell(row[h])).join(",")
    ),
  ];
  return lines.join("\r\n") + "\r\n";
}

/** Minimal RFC4180-ish CSV parse (handles quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      current.push(cell);
      cell = "";
    } else if (ch === "\n") {
      current.push(cell);
      cell = "";
      if (current.some((c) => c.trim() !== "")) rows.push(current);
      current = [];
    } else {
      cell += ch;
    }
  }
  if (cell.length || current.length) {
    current.push(cell);
    if (current.some((c) => c.trim() !== "")) rows.push(current);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? "";
    });
    return obj;
  });
}

function optStr(v: unknown): string | undefined {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

function optNum(v: unknown): number | undefined {
  const s = String(v ?? "").trim();
  if (s === "") return undefined;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

const BILL_STATUSES = new Set([
  "APPROVED",
  "PENDING_APPROVAL",
  "REJECTED",
  "IN_PROGRESS",
]);
const PAYMENT_STATUSES = new Set(["PAID", "UNPAID", "PARTIAL_PAID"]);
const PAYMENT_MODES = new Set(["CASH", "ONLINE"]);

function parseActivityLog(
  raw: unknown
): RestorePayload["bills"][0]["activityLog"] {
  if (raw == null || raw === "") return undefined;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return undefined;
    const actions = new Set([
      "CREATED",
      "UPDATED",
      "APPROVED",
      "REJECTED",
      "PAYMENT_UPDATED",
    ]);
    return parsed
      .filter(
        (e) =>
          e &&
          typeof e === "object" &&
          typeof e.at === "number" &&
          typeof e.byName === "string" &&
          actions.has(String(e.action))
      )
      .map((e) => ({
        at: e.at as number,
        byName: String(e.byName),
        byUserId:
          typeof e.byUserId === "string" ? e.byUserId : undefined,
        action: e.action as NonNullable<
          RestorePayload["bills"][0]["activityLog"]
        >[0]["action"],
      }));
  } catch {
    return undefined;
  }
}

export function parseExtraCharges(raw: unknown): { id: string; name: string; amount: number }[] {
  if (Array.isArray(raw)) {
    return raw.map((c, i) => ({
      id: String((c as any)?.id ?? `chg-${i}`),
      name: String((c as any)?.name ?? ""),
      amount: num((c as any)?.amount),
    }));
  }
  const s = String(raw ?? "").trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c, i) => ({
      id: String(c?.id ?? `chg-${i}`),
      name: String(c?.name ?? ""),
      amount: num(c?.amount),
    }));
  } catch {
    throw new Error(`Invalid extraCharges JSON: ${s.slice(0, 80)}`);
  }
}

export function rowsToRestorePayload(input: {
  customers: Record<string, unknown>[];
  bills: Record<string, unknown>[];
  settings: Record<string, unknown>[];
}): RestorePayload {
  const customers = input.customers.map((r, i) => {
    const id = String(r.id ?? "").trim();
    const name = String(r.name ?? "").trim();
    const mobile = String(r.mobile ?? "").trim();
    if (!id) throw new Error(`Customer row ${i + 1}: missing id`);
    if (!name) throw new Error(`Customer row ${i + 1}: missing name`);
    if (!mobile) throw new Error(`Customer row ${i + 1}: missing mobile`);
    return {
      id,
      name,
      mobile,
      location: optStr(r.location),
      state: optStr(r.state),
      pincode: optStr(r.pincode),
      notes: optStr(r.notes),
      createdAt: num(r.createdAt, Date.now()),
    };
  });

  const bills = input.bills.map((r, i) => {
    const customerId = String(r.customerId ?? "").trim();
    if (!customerId) throw new Error(`Bill row ${i + 1}: missing customerId`);
    const status = String(r.status ?? "APPROVED").trim().toUpperCase();
    const payment = String(r.paymentStatus ?? "UNPAID").trim().toUpperCase();
    const mode = String(r.paymentMode ?? "").trim().toUpperCase();
    if (!BILL_STATUSES.has(status)) {
      throw new Error(`Bill row ${i + 1}: invalid status "${r.status}"`);
    }
    if (!PAYMENT_STATUSES.has(payment)) {
      throw new Error(`Bill row ${i + 1}: invalid paymentStatus "${r.paymentStatus}"`);
    }
    if (mode && !PAYMENT_MODES.has(mode)) {
      throw new Error(`Bill row ${i + 1}: invalid paymentMode "${r.paymentMode}"`);
    }
    return {
      id: optStr(r.id),
      invoiceNumber: optStr(r.invoiceNumber),
      ertNumber: optStr(r.ertNumber),
      customerId,
      customerName: optStr(r.customerName),
      customerMobile: optStr(r.customerMobile),
      customerLocation: optStr(r.customerLocation),
      customerState: optStr(r.customerState),
      date: String(r.date ?? "").trim() || new Date().toISOString().slice(0, 10),
      endDate: optStr(r.endDate),
      startTime: optStr(r.startTime),
      endTime: optStr(r.endTime),
      hoursUsed: num(r.hoursUsed),
      hourlyRate: num(r.hourlyRate),
      extraCharges: parseExtraCharges(r.extraCharges),
      discount: num(r.discount),
      grandTotal: num(r.grandTotal),
      status: status as RestorePayload["bills"][0]["status"],
      paymentStatus: payment as RestorePayload["bills"][0]["paymentStatus"],
      paymentMode: mode
        ? (mode as RestorePayload["bills"][0]["paymentMode"])
        : undefined,
      amountPaid: optNum(r.amountPaid),
      balanceAmount: optNum(r.balanceAmount),
      createdBy: optStr(r.createdBy),
      createdByEmail: optStr(r.createdByEmail),
      createdAt: num(r.createdAt, Date.now()),
      outsideTamilNadu: ["true", "1", "yes"].includes(
        String(r.outsideTamilNadu ?? "").trim().toLowerCase()
      ),
      activityLog: parseActivityLog(r.activityLog),
    };
  });

  let settings: BackupSettingsRow | undefined;
  if (input.settings.length > 0) {
    const r = input.settings[0];
    const businessName = String(r.businessName ?? "").trim();
    if (!businessName) throw new Error("Settings: businessName is required");
    settings = {
      hourlyRate: num(r.hourlyRate, 1200),
      businessName,
      businessAddress: String(r.businessAddress ?? ""),
      phoneNumber: String(r.phoneNumber ?? ""),
      gstNumber: String(r.gstNumber ?? ""),
      invoicePrefix: String(r.invoicePrefix ?? "INV-") || "INV-",
      nextInvoiceNumber: Math.max(1, Math.floor(num(r.nextInvoiceNumber, 1))),
      invoiceNumberDigits: Math.min(
        8,
        Math.max(3, Math.floor(num(r.invoiceNumberDigits, 5)))
      ),
      currencySymbol: String(r.currencySymbol ?? "₹") || "₹",
      defaultTax: num(r.defaultTax),
      invoiceNotes: String(r.invoiceNotes ?? ""),
      footerText: String(r.footerText ?? ""),
      hsnCode: String(r.hsnCode ?? ""),
    };
  }

  return { customers, bills, settings };
}

export function detectEntityFromHeaders(headers: string[]): "customers" | "bills" | "settings" | null {
  const set = new Set(headers.map((h) => h.trim()));
  if (set.has("mobile") && set.has("name") && set.has("createdAt") && !set.has("customerId")) {
    return "customers";
  }
  if (set.has("customerId") && set.has("grandTotal") && set.has("hoursUsed")) {
    return "bills";
  }
  if (set.has("businessName") && set.has("invoicePrefix") && set.has("hourlyRate")) {
    return "settings";
  }
  return null;
}
