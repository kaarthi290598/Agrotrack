import { Bill, DashboardStats, UserProfile } from "../types";
import { getDBBills, saveDBBills } from "./db";
import { api } from "../convex/_generated/api";
import { customerService } from "./customer.service";
import { isBillCreatedByUser } from "../lib/utils";
import { resolveBillCustomer } from "../lib/bill-customer";
import { getAuthedConvexClient } from "../lib/convex-client";

export const billingService = {
  getAll: async (_orgId?: string): Promise<Bill[]> => {
    const convex = await getAuthedConvexClient();
    const data = await convex.query(api.bills.getAll, {});
    const mapped: Bill[] = data.map((b) => ({
      id: b._id,
      invoiceNumber: b.invoiceNumber,
      customerId: b.customerId,
      customerName: b.customerName,
      customerMobile: b.customerMobile,
      customerLocation: b.customerLocation,
      customerState: b.customerState,
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      hoursUsed: b.hoursUsed,
      hourlyRate: b.hourlyRate,
      extraCharges: b.extraCharges,
      discount: b.discount,
      grandTotal: b.grandTotal,
      status: b.status,
      paymentStatus: b.paymentStatus,
      amountPaid: b.amountPaid,
      balanceAmount: b.balanceAmount,
      createdBy: b.createdBy,
      createdByEmail: b.createdByEmail,
      createdAt: b.createdAt,
    }));
    saveDBBills(mapped);
    return mapped;
  },

  create: async (
    billData: Omit<Bill, "id" | "invoiceNumber" | "createdAt">,
    _orgId?: string
  ): Promise<Bill> => {
    const convex = await getAuthedConvexClient();
    const res = await convex.mutation(api.bills.create, {
      ...billData,
      status: billData.status || "PENDING_APPROVAL",
      paymentStatus: (billData.paymentStatus as any) || "UNPAID",
    });
    return {
      ...billData,
      id: res.id,
      invoiceNumber: res.invoiceNumber,
      status: billData.status || "PENDING_APPROVAL",
      paymentStatus: billData.paymentStatus || "UNPAID",
      createdAt: Date.now(),
    };
  },

  update: async (
    id: string,
    updatedFields: Partial<Omit<Bill, "id" | "invoiceNumber" | "createdAt">>
  ): Promise<Bill> => {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.bills.update, {
      id: id as any,
      ...(updatedFields as any),
    });
    return { id, ...updatedFields } as Bill;
  },

  updatePaymentStatus: async (
    id: string,
    paymentStatus: "PAID" | "UNPAID" | "PARTIAL_PAID",
    amountPaid?: number
  ): Promise<Bill> => {
    const convex = await getAuthedConvexClient();
    const localBills = getDBBills();
    const target = localBills.find((b) => b.id === id);
    const total = target?.grandTotal || 0;
    const paid =
      paymentStatus === "PARTIAL_PAID"
        ? amountPaid || 0
        : paymentStatus === "PAID"
          ? total
          : 0;
    const balance = Math.max(0, total - paid);

    await convex.mutation(api.bills.updatePaymentStatus, {
      id: id as any,
      paymentStatus: paymentStatus as any,
      amountPaid: paid,
      balanceAmount: balance,
    });

    const bills = getDBBills();
    const index = bills.findIndex((b) => b.id === id);
    if (index === -1) return { id, paymentStatus } as Bill;

    const targetBill = bills[index];
    targetBill.paymentStatus = paymentStatus;
    targetBill.amountPaid = paid;
    targetBill.balanceAmount = balance;
    bills[index] = targetBill;
    saveDBBills(bills);
    return targetBill;
  },

  approve: async (id: string): Promise<Bill> => {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.bills.approve, { id: id as any });
    return { id, status: "APPROVED" } as Bill;
  },

  reject: async (id: string): Promise<Bill> => {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.bills.reject, { id: id as any });
    return { id, status: "REJECTED" } as Bill;
  },

  delete: async (id: string): Promise<void> => {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.bills.remove, { id: id as any });
    saveDBBills(getDBBills().filter((b) => b.id !== id));
  },

  bulkApprove: async (ids: string[]): Promise<void> => {
    for (const id of ids) {
      await billingService.approve(id);
    }
  },

  bulkReject: async (ids: string[]): Promise<void> => {
    for (const id of ids) {
      await billingService.reject(id);
    }
  },

  bulkDelete: async (ids: string[]): Promise<void> => {
    for (const id of ids) {
      await billingService.delete(id);
    }
  },

  backfillCustomerSnapshots: async (): Promise<{ updated: number; total: number }> => {
    const convex = await getAuthedConvexClient();
    return await convex.mutation(api.bills.backfillCustomerSnapshots, {});
  },

  getStats: async (
    orgId?: string,
    user?: UserProfile | null,
    isAdmin: boolean = true
  ): Promise<
    DashboardStats & {
      monthlyStats: { date: string; amount: number }[];
      monthlyRevenue: { year: number; month: number; amount: number }[];
      availableYears: number[];
      locationStats: { location: string; amount: number }[];
    }
  > => {
    const rawBills = await billingService.getAll(orgId);
    const customers = await customerService.getAll(orgId);

    const bills = rawBills.filter(
      (b) =>
        isBillCreatedByUser(b, user || null, isAdmin) &&
        b.status === "APPROVED" &&
        b.paymentStatus === "PAID"
    );
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const totalCustomers = customers.length;
    const totalBills = bills.length;
    
    // Revenue calculations
    const totalRevenue = bills.reduce((sum, b) => sum + b.grandTotal, 0);
    
    // Today's revenue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    const todayRevenue = bills
      .filter((b) => b.createdAt >= todayTimestamp)
      .reduce((sum, b) => sum + b.grandTotal, 0);

    const averageBilling = totalBills > 0 ? Number((totalRevenue / totalBills).toFixed(2)) : 0;

    // Recent 5 bills with Customer Name
    const recentBills = bills.slice(0, 5).map((b) => ({
      ...b,
      ...resolveBillCustomer(b, customerMap),
    }));

    // Monthly revenue grouped by year-month (uses bill date)
    const monthlyRevenueMap = new Map<string, number>();
    bills.forEach((b) => {
      if (!b.date) return;
      const parts = b.date.split("-");
      if (parts.length < 2) return;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      if (isNaN(year) || isNaN(month)) return;
      const key = `${year}-${month}`;
      monthlyRevenueMap.set(key, (monthlyRevenueMap.get(key) || 0) + b.grandTotal);
    });

    const monthlyRevenue = Array.from(monthlyRevenueMap.entries()).map(([key, amount]) => {
      const [year, month] = key.split("-").map(Number);
      return { year, month, amount };
    });

    const yearSet = new Set(monthlyRevenue.map((r) => r.year));
    yearSet.add(new Date().getFullYear());
    const availableYears = Array.from(yearSet).sort((a, b) => b - a);

    // Revenue in the last 7 days for chart (legacy — kept for compatibility)
    const last7DaysMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      last7DaysMap.set(label, 0);
    }

    // Group bills by date
    bills.forEach((b) => {
      const billDate = new Date(b.createdAt);
      const label = billDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (last7DaysMap.has(label)) {
        last7DaysMap.set(label, last7DaysMap.get(label)! + b.grandTotal);
      }
    });

    const monthlyStats = Array.from(last7DaysMap.entries()).map(([date, amount]) => ({
      date,
      amount
    }));

    // Location wise statistics
    const locationRevenueMap = new Map<string, number>();
    bills.forEach((b) => {
      const resolved = resolveBillCustomer(b, customerMap);
      const location = resolved.customerLocation || "Other/Direct";
      locationRevenueMap.set(location, (locationRevenueMap.get(location) || 0) + b.grandTotal);
    });

    const locationStats = Array.from(locationRevenueMap.entries())
      .map(([location, amount]) => ({ location, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5); // top 5 locations

    return {
      totalCustomers,
      totalBills,
      totalRevenue,
      todayRevenue,
      averageBilling,
      recentBills,
      monthlyStats,
      monthlyRevenue,
      availableYears,
      locationStats
    };
  }
};
