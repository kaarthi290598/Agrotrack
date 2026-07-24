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
export type UserRole = "admin" | "user";

export interface UserProfile {
  id: string;
  fullName: string;
  primaryEmailAddress: string;
  role: UserRole;
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
