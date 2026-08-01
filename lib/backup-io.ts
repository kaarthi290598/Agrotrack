import * as XLSX from "xlsx";
import {
  BackupSnapshot,
  RestorePayload,
  BILL_HEADERS,
  CUSTOMER_HEADERS,
  SETTINGS_HEADERS,
  assertFullBackupSections,
  billsToRows,
  customersToRows,
  detectEntityFromHeaders,
  parseCsv,
  rowsToCsv,
  rowsToRestorePayload,
  settingsToRows,
} from "./backup-format";
import { createZipStore, unzipStoreTextFiles } from "./zip-store";

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Always `from-YYYY-MM-DD-to-YYYY-MM-DD` from filter dates or exported bill invoice dates. */
function stamp(snapshot?: BackupSnapshot): string {
  let from = snapshot?.startDate?.trim() || "";
  let to = snapshot?.endDate?.trim() || "";

  if (!from || !to) {
    const billDates = (snapshot?.bills ?? [])
      .map((b) => String(b.date || "").trim())
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    if (billDates.length > 0) {
      if (!from) from = billDates[0];
      if (!to) to = billDates[billDates.length - 1];
    }
  }

  const today = todayYmd();
  if (!from) from = today;
  if (!to) to = today;
  if (from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  return `from-${from}-to-${to}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadExcelBackup(snapshot: BackupSnapshot) {
  const wb = XLSX.utils.book_new();

  const customers = customersToRows(snapshot.customers);
  const bills = billsToRows(snapshot.bills);
  const settings = settingsToRows(snapshot.settings);

  const customerSheet = customers.length
    ? XLSX.utils.json_to_sheet(customers, { header: [...CUSTOMER_HEADERS] })
    : XLSX.utils.aoa_to_sheet([[...CUSTOMER_HEADERS]]);
  const billSheet = bills.length
    ? XLSX.utils.json_to_sheet(bills, { header: [...BILL_HEADERS] })
    : XLSX.utils.aoa_to_sheet([[...BILL_HEADERS]]);
  const settingsSheet = settings.length
    ? XLSX.utils.json_to_sheet(settings, { header: [...SETTINGS_HEADERS] })
    : XLSX.utils.aoa_to_sheet([[...SETTINGS_HEADERS]]);

  XLSX.utils.book_append_sheet(wb, customerSheet, "Customers");
  XLSX.utils.book_append_sheet(wb, billSheet, "Bills");
  XLSX.utils.book_append_sheet(wb, settingsSheet, "Settings");

  const filename = `trackerbilling-backup-${stamp(snapshot)}.xlsx`;
  XLSX.writeFile(wb, filename);
  return filename;
}

export function downloadCsvBackup(snapshot: BackupSnapshot) {
  const customersCsv = rowsToCsv(
    CUSTOMER_HEADERS,
    customersToRows(snapshot.customers)
  );
  const billsCsv = rowsToCsv(BILL_HEADERS, billsToRows(snapshot.bills));
  const settingsCsv = rowsToCsv(
    SETTINGS_HEADERS,
    settingsToRows(snapshot.settings)
  );

  const zip = createZipStore([
    { name: "customers.csv", content: customersCsv },
    { name: "bills.csv", content: billsCsv },
    { name: "settings.csv", content: settingsCsv },
  ]);
  const filename = `trackerbilling-backup-${stamp(snapshot)}.zip`;
  triggerDownload(zip, filename);
  return filename;
}

function sheetToRecords(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return rows.filter((r) =>
    Object.values(r).some((v) => String(v ?? "").trim() !== "")
  );
}

function buildRestorePayload(sections: {
  hasCustomersSection: boolean;
  hasBillsSection: boolean;
  customers: Record<string, unknown>[];
  bills: Record<string, unknown>[];
  settings: Record<string, unknown>[];
}): RestorePayload {
  assertFullBackupSections(sections);
  return rowsToRestorePayload({
    customers: sections.customers,
    bills: sections.bills,
    settings: sections.settings,
  });
}

export function parseExcelBackup(buffer: ArrayBuffer): RestorePayload {
  const wb = XLSX.read(buffer, { type: "array" });

  const byName: {
    customers: Record<string, unknown>[];
    bills: Record<string, unknown>[];
    settings: Record<string, unknown>[];
  } = {
    customers: [],
    bills: [],
    settings: [],
  };
  let hasCustomersSection = false;
  let hasBillsSection = false;

  for (const name of wb.SheetNames) {
    const records = sheetToRecords(wb.Sheets[name]);
    const headers =
      records.length > 0
        ? Object.keys(records[0])
        : ((XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], {
            header: 1,
            defval: "",
          })[0] as string[] | undefined) ?? []).map((h) => String(h));
    const key = name.toLowerCase();

    if (key.includes("customer")) {
      hasCustomersSection = true;
      byName.customers = records;
    } else if (key.includes("bill")) {
      hasBillsSection = true;
      byName.bills = records;
    } else if (key.includes("setting")) {
      byName.settings = records;
    } else if (headers.length > 0) {
      const detected = detectEntityFromHeaders(headers);
      if (detected === "customers") {
        hasCustomersSection = true;
        byName.customers = records;
      } else if (detected === "bills") {
        hasBillsSection = true;
        byName.bills = records;
      } else if (detected === "settings") {
        byName.settings = records;
      }
    }
  }

  return buildRestorePayload({
    hasCustomersSection,
    hasBillsSection,
    customers: byName.customers,
    bills: byName.bills,
    settings: byName.settings,
  });
}

export async function parseCsvBackup(file: File): Promise<RestorePayload> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".zip")) {
    const files = await unzipStoreTextFiles(await file.arrayBuffer());
    const customersEntry =
      files["customers.csv"] ||
      Object.entries(files).find(([k]) => k.toLowerCase().includes("customer"))?.[1];
    const billsEntry =
      files["bills.csv"] ||
      Object.entries(files).find(([k]) => k.toLowerCase().includes("bill"))?.[1];
    const settingsEntry =
      files["settings.csv"] ||
      Object.entries(files).find(([k]) => k.toLowerCase().includes("setting"))?.[1];

    return buildRestorePayload({
      hasCustomersSection: customersEntry !== undefined,
      hasBillsSection: billsEntry !== undefined,
      customers: customersEntry ? parseCsv(customersEntry) : [],
      bills: billsEntry ? parseCsv(billsEntry) : [],
      settings: settingsEntry ? parseCsv(settingsEntry) : [],
    });
  }

  if (name.endsWith(".csv")) {
    throw new Error(
      "Single CSV files are not supported for restore. Import the full ZIP or Excel backup."
    );
  }

  throw new Error("Unsupported file. Use the backup ZIP or Excel (.xlsx).");
}

export async function parseCsvBackupFiles(
  files: FileList | File[]
): Promise<RestorePayload> {
  const list = Array.from(files);
  if (list.length === 1 && list[0].name.toLowerCase().endsWith(".zip")) {
    return parseCsvBackup(list[0]);
  }

  if (list.length === 1 && list[0].name.toLowerCase().endsWith(".csv")) {
    throw new Error(
      "Single CSV files are not supported for restore. Import the full ZIP or Excel backup."
    );
  }

  let customers: Record<string, string>[] = [];
  let bills: Record<string, string>[] = [];
  let settings: Record<string, string>[] = [];
  let hasCustomersSection = false;
  let hasBillsSection = false;

  for (const file of list) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv")) continue;
    const text = await file.text();
    const records = parseCsv(text);
    let entity =
      records.length > 0
        ? detectEntityFromHeaders(Object.keys(records[0]))
        : null;
    if (!entity) {
      if (lower.includes("customer")) entity = "customers";
      else if (lower.includes("bill")) entity = "bills";
      else if (lower.includes("setting")) entity = "settings";
    }
    if (entity === "customers") {
      hasCustomersSection = true;
      customers = records;
    } else if (entity === "bills") {
      hasBillsSection = true;
      bills = records;
    } else if (entity === "settings") {
      settings = records;
    }
  }

  return buildRestorePayload({
    hasCustomersSection,
    hasBillsSection,
    customers,
    bills,
    settings,
  });
}
