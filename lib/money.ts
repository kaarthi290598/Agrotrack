/** Round to nearest whole rupee for storage and display. */
export function roundRupee(amount: number | string | null | undefined): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/** Non-negative whole-rupee amount. */
export function roundRupeeNonNegative(
  amount: number | string | null | undefined
): number {
  return Math.max(0, roundRupee(amount));
}

/** Format for UI: ₹1,234 (no paise). */
export function formatRupee(
  amount: number | string | null | undefined,
  currencySymbol = "₹"
): string {
  return `${currencySymbol}${roundRupee(amount).toLocaleString("en-IN")}`;
}
