import { z } from "zod";

/** Strip everything except digits. */
export function digitsOnly(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Normalize to at most 10 digits for controlled inputs. */
export function normalizeMobileInput(value: string): string {
  return digitsOnly(value).slice(0, 10);
}

/** Exactly 10 digits (India-style mobile). */
export const mobileNumberSchema = z
  .string()
  .transform((s) => digitsOnly(s))
  .pipe(
    z
      .string()
      .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits")
  );

export function assertValidMobile(mobile: string): string {
  const normalized = digitsOnly(mobile);
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error("Mobile number must be exactly 10 digits");
  }
  return normalized;
}
