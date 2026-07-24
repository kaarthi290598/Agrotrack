import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isBillCreatedByUser(
  bill: { createdBy?: string; createdByEmail?: string },
  user: { fullName?: string; primaryEmailAddress?: string } | null,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  if (!user) return true;

  const userEmail = (user.primaryEmailAddress || "").toLowerCase().trim();
  const userName = (user.fullName || "").toLowerCase().trim();
  const billEmail = (bill.createdByEmail || "").toLowerCase().trim();
  const billName = (bill.createdBy || "").toLowerCase().trim();

  // If bill creator info exists, check against current user's email/name
  if (billEmail || billName) {
    if (userEmail && billEmail && billEmail === userEmail) return true;
    if (userName && billName && billName === userName) return true;
    if (userEmail && billName && billName === userEmail) return true;
    // Handle mock / test operator user
    if (billName === "operator" || billEmail === "operator@demo.com") return true;
    return false;
  }

  // Fallback for bills without creator info attached
  return true;
}

