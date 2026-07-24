import { Customer } from "../types";
import { getDBCustomers, saveDBCustomers } from "./db";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://different-puffin-360.convex.cloud";
const convex = new ConvexHttpClient(convexUrl);

export const customerService = {
  getAll: async (orgId?: string): Promise<Customer[]> => {
    try {
      const data = await convex.query(api.customers.getAll, { orgId });
      const mapped: Customer[] = data.map((c) => ({
        id: c._id,
        name: c.name,
        mobile: c.mobile,
        location: c.location,
        state: c.state,
        notes: c.notes,
        createdAt: c.createdAt,
      }));
      return mapped;
    } catch (e) {
      console.warn("Falling back to local DB for customers:", e);
      return getDBCustomers();
    }
  },

  getById: async (id: string, orgId?: string): Promise<Customer | null> => {
    const customers = await customerService.getAll(orgId);
    return customers.find((c) => c.id === id) || null;
  },

  create: async (customerData: Omit<Customer, "id" | "createdAt">, orgId?: string): Promise<Customer> => {
    try {
      const id = await convex.mutation(api.customers.create, { ...customerData, orgId });
      const newCustomer: Customer = {
        ...customerData,
        id,
        createdAt: Date.now(),
      };
      return newCustomer;
    } catch (e) {
      console.warn("Convex customer create fallback:", e);
      const customers = getDBCustomers();
      const newCustomer: Customer = {
        ...customerData,
        id: `cust-${Date.now()}`,
        createdAt: Date.now(),
      };
      customers.push(newCustomer);
      saveDBCustomers(customers);
      return newCustomer;
    }
  },

  update: async (id: string, customerData: Partial<Customer>): Promise<Customer> => {
    try {
      if (id.length > 15) {
        await convex.mutation(api.customers.update, {
          id: id as any,
          ...customerData,
        });
        return { id, ...customerData, createdAt: Date.now() } as Customer;
      }
    } catch (e) {
      console.warn("Convex customer update fallback:", e);
    }
    const customers = getDBCustomers();
    const index = customers.findIndex((c) => c.id === id);
    if (index !== -1) {
      customers[index] = { ...customers[index], ...customerData };
      saveDBCustomers(customers);
      return customers[index];
    }
    return { ...customerData, id, createdAt: Date.now() } as Customer;
  },

  delete: async (id: string): Promise<void> => {
    try {
      if (id.length > 15) {
        await convex.mutation(api.customers.remove, { id: id as any });
        return;
      }
    } catch (e) {
      console.warn("Convex customer delete fallback:", e);
    }
    const customers = getDBCustomers();
    const updated = customers.filter((c) => c.id !== id);
    saveDBCustomers(updated);
  },
};
