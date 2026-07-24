import { Bill, DashboardStats, UserProfile } from "../types";
import { getDBBills, saveDBBills, getDBCustomers, getDBSettings } from "./db";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { customerService } from "./customer.service";
import { isBillCreatedByUser } from "../lib/utils";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://different-puffin-360.convex.cloud";
const convex = new ConvexHttpClient(convexUrl);

export const billingService = {
  getAll: async (orgId?: string): Promise<Bill[]> => {
    try {
      const data = await convex.query(api.bills.getAll, { orgId });
      const mapped: Bill[] = data.map((b) => ({
        id: b._id,
        invoiceNumber: b.invoiceNumber,
        customerId: b.customerId,
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
        createdBy: b.createdBy,
        createdByEmail: b.createdByEmail,
        createdAt: b.createdAt,
      }));
      return mapped;
    } catch (e) {
      console.warn("Falling back to local DB for bills:", e);
      return getDBBills();
    }
  },

  create: async (billData: Omit<Bill, "id" | "invoiceNumber" | "createdAt">, orgId?: string): Promise<Bill> => {
    try {
      const res = await convex.mutation(api.bills.create, {
        ...billData,
        orgId,
        status: billData.status || "PENDING_APPROVAL",
        paymentStatus: billData.paymentStatus || "UNPAID",
      });
      const newBill: Bill = {
        ...billData,
        id: res.id,
        invoiceNumber: res.invoiceNumber,
        status: billData.status || "PENDING_APPROVAL",
        paymentStatus: billData.paymentStatus || "UNPAID",
        createdAt: Date.now(),
      };
      return newBill;
    } catch (e) {
      console.warn("Convex bill create fallback:", e);
      const bills = getDBBills();
      const settings = getDBSettings();
      let maxNum = 0;
      const prefix = settings.invoicePrefix || "INV-";
      bills.forEach((b) => {
        if (b.invoiceNumber.startsWith(prefix)) {
          const suffix = b.invoiceNumber.substring(prefix.length);
          const num = parseInt(suffix, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
      const nextNum = maxNum + 1;
      const invoiceNumber = `${prefix}${String(nextNum).padStart(5, "0")}`;
      const newBill: Bill = {
        ...billData,
        id: `bill-${Date.now()}`,
        invoiceNumber,
        status: billData.status || "PENDING_APPROVAL",
        paymentStatus: billData.paymentStatus || "UNPAID",
        createdAt: Date.now(),
      };
      bills.unshift(newBill);
      saveDBBills(bills);
      return newBill;
    }
  },

  update: async (id: string, updatedFields: Partial<Omit<Bill, "id" | "invoiceNumber" | "createdAt">>): Promise<Bill> => {
    try {
      if (id.length > 15) {
        await convex.mutation(api.bills.update, {
          id: id as any,
          ...updatedFields,
        });
        return { id, ...updatedFields } as Bill;
      }
    } catch (e) {
      console.warn("Convex bill update fallback:", e);
    }
    const bills = getDBBills();
    const index = bills.findIndex((b) => b.id === id);
    if (index === -1) {
      return { id, ...updatedFields } as Bill;
    }
    const updatedBill: Bill = {
      ...bills[index],
      ...updatedFields,
      status: updatedFields.status !== undefined ? updatedFields.status : bills[index].status,
    };
    bills[index] = updatedBill;
    saveDBBills(bills);
    return updatedBill;
  },

  updatePaymentStatus: async (id: string, paymentStatus: "PAID" | "UNPAID"): Promise<Bill> => {
    try {
      if (id.length > 15) {
        await convex.mutation(api.bills.updatePaymentStatus, {
          id: id as any,
          paymentStatus,
        });
        return { id, paymentStatus } as Bill;
      }
    } catch (e) {
      console.warn("Convex payment status update fallback:", e);
    }
    const bills = getDBBills();
    const index = bills.findIndex((b) => b.id === id);
    if (index === -1) return { id, paymentStatus } as Bill;
    bills[index].paymentStatus = paymentStatus;
    saveDBBills(bills);
    return bills[index];
  },

  approve: async (id: string): Promise<Bill> => {
    try {
      if (id.length > 15) {
        await convex.mutation(api.bills.approve, { id: id as any });
        return { id, status: "APPROVED" } as Bill;
      }
    } catch (e) {
      console.warn("Convex bill approve fallback:", e);
    }
    const bills = getDBBills();
    const index = bills.findIndex((b) => b.id === id);
    if (index === -1) return { id, status: "APPROVED" } as Bill;
    bills[index].status = "APPROVED";
    saveDBBills(bills);
    return bills[index];
  },

  reject: async (id: string): Promise<Bill> => {
    try {
      if (id.length > 15) {
        await convex.mutation(api.bills.reject, { id: id as any });
        return { id, status: "REJECTED" } as Bill;
      }
    } catch (e) {
      console.warn("Convex bill reject fallback:", e);
    }
    const bills = getDBBills();
    const index = bills.findIndex((b) => b.id === id);
    if (index === -1) return { id, status: "REJECTED" } as Bill;
    bills[index].status = "REJECTED";
    saveDBBills(bills);
    return bills[index];
  },

  delete: async (id: string): Promise<void> => {
    try {
      if (id.length > 15) {
        await convex.mutation(api.bills.remove, { id: id as any });
        return;
      }
    } catch (e) {
      console.warn("Convex bill delete fallback:", e);
    }
    const bills = getDBBills();
    const updated = bills.filter((b) => b.id !== id);
    saveDBBills(updated);
  },

  getStats: async (
    orgId?: string, 
    user?: UserProfile | null, 
    isAdmin: boolean = true
  ): Promise<DashboardStats & { 
    monthlyStats: { date: string; amount: number }[];
    locationStats: { location: string; amount: number }[];
  }> => {
    const rawBills = await billingService.getAll(orgId);
    const customers = await customerService.getAll(orgId);

    // Scoped bills for member vs admin
    const bills = rawBills.filter((b) => isBillCreatedByUser(b, user || null, isAdmin));

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
      customerName: customerMap.get(b.customerId)?.name || "Unknown Customer"
    }));

    // Revenue in the last 7 days for chart
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
      const customer = customerMap.get(b.customerId);
      const location = customer?.location || "Other/Direct";
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
      locationStats
    };
  }
};
