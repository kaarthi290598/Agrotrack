export interface Customer {
  id: string;
  name: string;
  mobile: string;
  location?: string;
  state?: string;
  pincode?: string;
  notes?: string;
  createdAt: number;
}

export interface AdditionalCharge {
  id: string;
  name: string;
  amount: number;
}

export type BillStatus = "APPROVED" | "PENDING_APPROVAL" | "REJECTED" | "IN_PROGRESS";
export type PaymentStatus = "PAID" | "UNPAID" | "PARTIAL_PAID";
/** Application roles stored in Convex (independent of Clerk org roles). */
export type UserRole = "ADMIN" | "BUSINESS_OPERATIONS_LEAD" | "SUPERVISOR";

export interface UserProfile {
  id: string;
  fullName: string;
  primaryEmailAddress: string;
  role: UserRole;
}

export function isAppAdmin(role: UserRole | null | undefined): boolean {
  return role === "ADMIN";
}

/** ADMIN + BUSINESS_OPERATIONS_LEAD — elevated operational access (not settings/members). */
export function hasElevatedAccess(role: UserRole | null | undefined): boolean {
  return role === "ADMIN" || role === "BUSINESS_OPERATIONS_LEAD";
}

export function canAccessSettings(role: UserRole | null | undefined): boolean {
  return role === "ADMIN";
}

export function canManageMembers(role: UserRole | null | undefined): boolean {
  return role === "ADMIN";
}

export function canAccessDashboard(role: UserRole | null | undefined): boolean {
  return role === "ADMIN" || role === "BUSINESS_OPERATIONS_LEAD";
}

export function canAccessReports(role: UserRole | null | undefined): boolean {
  return role === "ADMIN" || role === "BUSINESS_OPERATIONS_LEAD";
}

/** Paths each role may open. Unknown paths fall through to deny for SUPERVISORs. */
export function getAllowedPaths(role: UserRole | null | undefined): string[] {
  if (role === "ADMIN") {
    return ["/", "/billing", "/bills", "/customers", "/members", "/reports", "/settings"];
  }
  if (role === "BUSINESS_OPERATIONS_LEAD") {
    return ["/", "/billing", "/bills", "/customers", "/reports"];
  }
  // SUPERVISOR (basic role)
  return ["/billing", "/bills", "/customers"];
}

export function canAccessPath(
  role: UserRole | null | undefined,
  pathname: string
): boolean {
  const allowed = getAllowedPaths(role);
  return allowed.some(
    (path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`))
  );
}

export function getDefaultPath(role: UserRole | null | undefined): string {
  return canAccessDashboard(role) ? "/" : "/billing";
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName?: string;
  customerMobile?: string;
  customerLocation?: string;
  customerState?: string;
  date: string; // ISO string or YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  hoursUsed: number;
  hourlyRate: number;
  extraCharges: AdditionalCharge[];
  discount: number;
  grandTotal: number;
  status: BillStatus;
  paymentStatus: PaymentStatus;
  amountPaid?: number;
  balanceAmount?: number;
  createdBy?: string;
  createdByEmail?: string;
  createdAt: number;
}

export interface Settings {
  hourlyRate: number;
  businessName: string;
  businessAddress: string;
  phoneNumber: string;
  gstNumber?: string;
  invoicePrefix: string;
  currencySymbol: string;
  defaultTax: number; // default tax % (can be 0)
  invoiceNotes?: string;
  footerText?: string;
}

export interface DashboardStats {
  totalCustomers: number;
  totalBills: number;
  totalRevenue: number;
  todayRevenue: number;
  averageBilling: number;
  recentBills: (Bill & { customerName?: string })[];
}
