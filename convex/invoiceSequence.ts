/** Invoice sequence helpers for Convex mutations/queries. */

export const DEFAULT_INVOICE_NUMBER_DIGITS = 5;
export const MIN_INVOICE_NUMBER_DIGITS = 3;
export const MAX_INVOICE_NUMBER_DIGITS = 8;

export function normalizeInvoiceDigits(digits?: number | null): number {
  const n = Math.floor(Number(digits) || DEFAULT_INVOICE_NUMBER_DIGITS);
  return Math.min(
    MAX_INVOICE_NUMBER_DIGITS,
    Math.max(MIN_INVOICE_NUMBER_DIGITS, n)
  );
}

export function padInvoiceSequence(
  sequence: number,
  digits?: number | null
): string {
  const n = Math.max(1, Math.floor(Number(sequence) || 1));
  const pad = normalizeInvoiceDigits(digits);
  return String(n).padStart(pad, "0");
}

export function formatInvoiceNumber(
  prefix: string,
  sequence: number,
  digits?: number | null
): string {
  const safePrefix = String(prefix || "INV-");
  return `${safePrefix}${padInvoiceSequence(sequence, digits)}`;
}

export function parseInvoiceSuffix(
  invoiceNumber: string,
  prefix: string
): number | null {
  if (!invoiceNumber.startsWith(prefix)) return null;
  const suffix = invoiceNumber.substring(prefix.length);
  if (!/^\d+$/.test(suffix)) return null;
  const num = parseInt(suffix, 10);
  return Number.isNaN(num) ? null : num;
}

export function maxUsedInvoiceSequence(
  invoiceNumbers: Array<string | undefined | null>,
  prefix: string
): number {
  let max = 0;
  for (const invoiceNumber of invoiceNumbers) {
    if (!invoiceNumber) continue;
    const num = parseInvoiceSuffix(invoiceNumber, prefix);
    if (num !== null && num > max) max = num;
  }
  return max;
}
