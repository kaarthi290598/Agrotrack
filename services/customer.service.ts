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
      // Always sync local cache so stale mock data cannot linger
      saveDBCustomers(mapped);
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
    let newCustomer: Customer;
    try {
      const id = await convex.mutation(api.customers.create, { ...customerData, orgId });
      newCustomer = {
        ...customerData,
        id,
        createdAt: Date.now(),
      };
    } catch (e) {
      console.warn("Convex customer create fallback:", e);
      newCustomer = {
        ...customerData,
        id: `cust-${Date.now()}`,
        createdAt: Date.now(),
      };
    }
    // Always persist to local DB immediately so UI sees it instantly
    const local = getDBCustomers();
    const updated = [newCustomer, ...local.filter((c) => c.id !== newCustomer.id)];
    saveDBCustomers(updated);
    return newCustomer;
  },

  update: async (id: string, customerData: Partial<Customer>): Promise<Customer> => {
    let updatedCustomer: Customer = { ...customerData, id, createdAt: Date.now() } as Customer;
    try {
      if (id.length > 15) {
        await convex.mutation(api.customers.update, {
          id: id as any,
          ...customerData,
        });
      }
    } catch (e) {
      console.warn("Convex customer update fallback:", e);
    }
    const customers = getDBCustomers();
    const index = customers.findIndex((c) => c.id === id);
    if (index !== -1) {
      customers[index] = { ...customers[index], ...customerData };
      updatedCustomer = customers[index];
    } else {
      customers.unshift(updatedCustomer);
    }
    saveDBCustomers(customers);
    return updatedCustomer;
  },

  delete: async (id: string): Promise<void> => {
    try {
      if (id.length > 15) {
        await convex.mutation(api.customers.remove, { id: id as any });
      }
    } catch (e) {
      console.warn("Convex customer delete fallback:", e);
    }
    const customers = getDBCustomers();
    const updated = customers.filter((c) => c.id !== id);
    saveDBCustomers(updated);
  },
};
