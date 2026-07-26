import { Customer } from "../types";
import { getDBCustomers, saveDBCustomers } from "./db";
import { api } from "../convex/_generated/api";
import { getAuthedConvexClient } from "../lib/convex-client";

export const customerService = {
  getAll: async (_orgId?: string): Promise<Customer[]> => {
    const convex = await getAuthedConvexClient();
    const data = await convex.query(api.customers.getAll, {});
    const mapped: Customer[] = data.map((c) => ({
      id: c._id,
      name: c.name,
      mobile: c.mobile,
      location: c.location,
      state: c.state,
      notes: c.notes,
      createdAt: c.createdAt,
    }));
    saveDBCustomers(mapped);
    return mapped;
  },

  getById: async (id: string, orgId?: string): Promise<Customer | null> => {
    const customers = await customerService.getAll(orgId);
    return customers.find((c) => c.id === id) || null;
  },

  create: async (
    customerData: Omit<Customer, "id" | "createdAt">,
    _orgId?: string
  ): Promise<Customer> => {
    const convex = await getAuthedConvexClient();
    const id = await convex.mutation(api.customers.create, { ...customerData });
    const newCustomer: Customer = {
      ...customerData,
      id,
      createdAt: Date.now(),
    };
    const local = getDBCustomers();
    saveDBCustomers([newCustomer, ...local.filter((c) => c.id !== newCustomer.id)]);
    return newCustomer;
  },

  update: async (id: string, customerData: Partial<Customer>): Promise<Customer> => {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.customers.update, {
      id: id as any,
      ...customerData,
    });
    const customers = getDBCustomers();
    const index = customers.findIndex((c) => c.id === id);
    let updatedCustomer: Customer;
    if (index !== -1) {
      customers[index] = { ...customers[index], ...customerData };
      updatedCustomer = customers[index];
    } else {
      updatedCustomer = { ...customerData, id, createdAt: Date.now() } as Customer;
      customers.unshift(updatedCustomer);
    }
    saveDBCustomers(customers);
    return updatedCustomer;
  },

  delete: async (id: string): Promise<void> => {
    const convex = await getAuthedConvexClient();
    await convex.mutation(api.customers.remove, { id: id as any });
    saveDBCustomers(getDBCustomers().filter((c) => c.id !== id));
  },
};
