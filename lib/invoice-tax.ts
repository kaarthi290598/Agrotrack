/** Tax-exclusive invoice totals: grandTotal is the taxable subtotal. */

export type InvoiceTaxBreakdown = {
  subtotal: number;
  taxRate: number;
  tax: number;
  cgst: number;
  sgst: number;
  invoiceTotal: number;
};

export function computeInvoiceTax(
  grandTotal: number,
  defaultTax: number
): InvoiceTaxBreakdown {
  const subtotal = Math.max(0, Number(grandTotal) || 0);
  const taxRate = Math.max(0, Number(defaultTax) || 0);
  const tax = taxRate > 0 ? (subtotal * taxRate) / 100 : 0;
  const cgst = tax / 2;
  const sgst = tax / 2;
  return {
    subtotal,
    taxRate,
    tax,
    cgst,
    sgst,
    invoiceTotal: subtotal + tax,
  };
}

export function formatInvoiceMoney(
  amount: number,
  currencySymbol: string
): string {
  const rounded = Math.round((Number(amount) || 0) * 100) / 100;
  return `${currencySymbol}${rounded.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatInvoiceDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date || "";
  const parsed = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
