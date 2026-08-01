import ExcelJS from "exceljs";
import type { Bill, Settings } from "../types";

type GstReportBill = Bill & {
  customerName?: string;
  customerLocation?: string;
};

type GstReportRange = {
  startDate?: string;
  endDate?: string;
};

const HEADERS = [
  "SNo.",
  "Bill",
  "BillDateShow",
  "Customer",
  "Nett",
  "Cash",
  "Cheque",
  "Online",
  "Card",
  "Credit",
  "Pending",
  "SubTotal1",
  "Disc%",
  "DiscRs",
  "SubTotal2",
  "Tax",
  "Packing",
  "Delivery",
  "Nett",
  "FY",
  "Remarks",
] as const;

const MONEY_COLUMNS = [5, 6, 8, 11, 12, 14, 15, 16, 17, 18, 19];
const TOTAL_COLUMNS = [5, 6, 8, 11, 12, 14, 15, 16, 17, 18, 19];

function reportSpan(
  bills: GstReportBill[],
  range: GstReportRange
): { from: string; to: string } {
  const dates = bills
    .map((bill) => bill.date)
    .filter((date): date is string => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  const today = new Date().toISOString().slice(0, 10);
  return {
    from: range.startDate || dates[0] || today,
    to: range.endDate || dates[dates.length - 1] || today,
  };
}

function formatBillDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date || "";
  const parsed = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return parsed
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    })
    .replace(/ /g, "-");
}

function financialYearStart(date: string): number | "" {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 4 ? year : year - 1;
}

function sumCharges(
  bill: GstReportBill,
  matcher: (name: string) => boolean
): number {
  return bill.extraCharges.reduce(
    (total, charge) =>
      matcher(charge.name.toLowerCase()) ? total + charge.amount : total,
    0
  );
}

function makeRow(
  bill: GstReportBill,
  index: number,
  taxRate: number
): Array<string | number | null> {
  const grandTotal = Number(bill.grandTotal) || 0;
  const discount = Number(bill.discount) || 0;
  const tax =
    taxRate > 0 ? (grandTotal * taxRate) / (100 + taxRate) : 0;
  const paidAmount =
    bill.amountPaid === undefined ? grandTotal : Number(bill.amountPaid) || 0;
  const pending =
    bill.balanceAmount === undefined ? 0 : Number(bill.balanceAmount) || 0;
  const subtotal1 = grandTotal + discount;
  const discountPercent =
    subtotal1 > 0 ? (discount / subtotal1) * 100 : 0;
  const packing = sumCharges(bill, (name) => name.includes("packing"));
  const delivery = sumCharges(
    bill,
    (name) => name.includes("delivery") || name.includes("transport")
  );
  const customer = [bill.customerName, bill.customerLocation]
    .filter(Boolean)
    .join(" - ");

  return [
    index + 1,
    bill.invoiceNumber || "",
    formatBillDate(bill.date),
    customer,
    grandTotal,
    bill.paymentMode === "CASH" ? paidAmount : null,
    null,
    bill.paymentMode === "ONLINE" ? paidAmount : null,
    null,
    null,
    pending,
    subtotal1,
    discountPercent,
    discount,
    grandTotal - tax,
    tax,
    packing,
    delivery,
    grandTotal,
    financialYearStart(bill.date),
    null,
  ];
}

function downloadBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadGstSalesReport(args: {
  bills: GstReportBill[];
  settings: Settings;
  range: GstReportRange;
}): Promise<string> {
  const { bills, settings, range } = args;
  const span = reportSpan(bills, range);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings.businessName || "Tracker Billing";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Sales Report", {
    views: [{ state: "frozen", ySplit: 7 }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
  });

  const fullRange = "A1:U1";
  sheet.mergeCells(fullRange);
  sheet.getCell("A1").value = "Sales Report";
  sheet.mergeCells("A2:U2");
  sheet.getCell("A2").value = settings.businessName || "";
  sheet.mergeCells("A3:U3");
  sheet.getCell("A3").value = settings.businessAddress || "";
  sheet.mergeCells("A4:U4");
  sheet.getCell("A4").value = settings.phoneNumber
    ? `PH : ${settings.phoneNumber}`
    : "";
  sheet.mergeCells("A5:U5");
  sheet.getCell("A5").value = settings.gstNumber
    ? `GSTIN : ${settings.gstNumber}`
    : "";
  sheet.mergeCells("A6:U6");
  sheet.getCell("A6").value =
    `Report Date From ${span.from} To ${span.to}`;

  for (let rowNumber = 1; rowNumber <= 6; rowNumber++) {
    const cell = sheet.getCell(rowNumber, 1);
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.font = {
      name: "Arial",
      size: rowNumber === 2 ? 15 : rowNumber === 1 ? 10 : 9,
      bold: rowNumber === 1 || rowNumber === 2 || rowNumber === 6,
    };
  }
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 28;

  const headerRow = sheet.addRow([...HEADERS]);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 8, bold: true };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE7E6E6" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF808080" } },
      left: { style: "thin", color: { argb: "FF808080" } },
      bottom: { style: "thin", color: { argb: "FF808080" } },
      right: { style: "thin", color: { argb: "FF808080" } },
    };
  });

  const taxRate = Math.max(0, Number(settings.defaultTax) || 0);
  bills.forEach((bill, index) => {
    const row = sheet.addRow(makeRow(bill, index, taxRate));
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.font = { name: "Arial", size: 8 };
      cell.alignment = {
        horizontal:
          columnNumber === 4 || columnNumber === 21 ? "left" : "right",
        vertical: "middle",
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFB0B0B0" } },
        left: { style: "thin", color: { argb: "FFB0B0B0" } },
        bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
        right: { style: "thin", color: { argb: "FFB0B0B0" } },
      };
      if (MONEY_COLUMNS.includes(columnNumber) && cell.value !== null) {
        cell.numFmt = "#,##0.00";
      }
      if (columnNumber === 13 && cell.value !== null) {
        cell.numFmt = "0.000000";
      }
    });
  });

  const totalRowNumber = sheet.rowCount + 1;
  const totalRow = sheet.addRow(Array(HEADERS.length).fill(null));
  totalRow.getCell(4).value = "Total :";
  totalRow.getCell(4).alignment = { horizontal: "right" };
  for (const column of TOTAL_COLUMNS) {
    totalRow.getCell(column).value = {
      formula: `SUM(${sheet.getColumn(column).letter}8:${sheet.getColumn(column).letter}${totalRowNumber - 1})`,
    };
    totalRow.getCell(column).numFmt = "#,##0.00";
  }
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: "Arial", size: 8, bold: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF808080" } },
      left: { style: "thin", color: { argb: "FF808080" } },
      bottom: { style: "thin", color: { argb: "FF808080" } },
      right: { style: "thin", color: { argb: "FF808080" } },
    };
  });

  const widths = [
    7, 18, 14, 34, 14, 13, 13, 13, 13, 13, 13, 14, 12, 13, 14, 13, 12,
    12, 14, 8, 24,
  ];
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: 7, column: HEADERS.length },
  };

  const filename =
    `gst-sales-report-from-${span.from}-to-${span.to}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBuffer(buffer, filename);
  return filename;
}
