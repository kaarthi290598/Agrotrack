import { mutation } from "./_generated/server";
import { v } from "convex/values";

const ORG_1_ID = "org_3GrXhdol8iMbzTjNSZCyXoe4WeR";
const ORG_2_ID = "org_3GrWJgyqNyPKRbYSnwvYjZnpW9D";

export const seedMultiOrgData = mutation({
  handler: async (ctx) => {
    // 1. Wipe old unassigned or previous data
    const existingBills = await ctx.db.query("bills").collect();
    for (const b of existingBills) {
      await ctx.db.delete(b._id);
    }

    const existingCustomers = await ctx.db.query("customers").collect();
    for (const c of existingCustomers) {
      await ctx.db.delete(c._id);
    }

    const existingSettings = await ctx.db.query("settings").collect();
    for (const s of existingSettings) {
      await ctx.db.delete(s._id);
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // ==========================================
    // SEED DATA FOR ORGANIZATION 1 (org_3GrXhdol8iMbzTjNSZCyXoe4WeR)
    // ==========================================
    await ctx.db.insert("settings", {
      orgId: ORG_1_ID,
      hourlyRate: 1500,
      businessName: "Arkit Agriculture Logistics (Org 1)",
      businessAddress: "Sector 4, Arkit Tech Hub, Bengaluru, Karnataka - 560001",
      phoneNumber: "+91 98450 11111",
      gstNumber: "29ARKIT1111A1Z1",
      invoicePrefix: "ARK-",
      currencySymbol: "₹",
      defaultTax: 0,
      invoiceNotes: "Arkit Org 1 Invoice: Payment due within 5 days.",
      footerText: "Arkit Org 1 Billing Portal",
    });

    const cust1_org1 = await ctx.db.insert("customers", {
      orgId: ORG_1_ID,
      name: "Rajesh Gowda (Org 1)",
      mobile: "9845012345",
      location: "Hebbal",
      state: "Karnataka",
      notes: "Arkit primary farmer client",
      createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    });

    const cust2_org1 = await ctx.db.insert("customers", {
      orgId: ORG_1_ID,
      name: "Suresh Kumar (Org 1)",
      mobile: "9845012346",
      location: "Bidadi",
      state: "Karnataka",
      notes: "Arkit heavy tractor client",
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    });

    await ctx.db.insert("bills", {
      orgId: ORG_1_ID,
      invoiceNumber: "ARK-00001",
      customerId: cust1_org1,
      date: todayStr,
      startTime: "08:00",
      endTime: "12:00",
      hoursUsed: 4,
      hourlyRate: 1500,
      extraCharges: [{ id: "chg-1", name: "Diesel Fee", amount: 600 }],
      discount: 100,
      grandTotal: 6500,
      status: "APPROVED",
      paymentStatus: "PAID",
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    });

    await ctx.db.insert("bills", {
      orgId: ORG_1_ID,
      invoiceNumber: "ARK-00002",
      customerId: cust2_org1,
      date: todayStr,
      startTime: "09:00",
      endTime: undefined,
      hoursUsed: 0,
      hourlyRate: 1500,
      extraCharges: [],
      discount: 0,
      grandTotal: 0,
      status: "IN_PROGRESS",
      paymentStatus: "UNPAID",
      createdAt: Date.now(),
    });

    // ==========================================
    // SEED DATA FOR ORGANIZATION 2 (org_3GrWJgyqNyPKRbYSnwvYjZnpW9D)
    // ==========================================
    await ctx.db.insert("settings", {
      orgId: ORG_2_ID,
      hourlyRate: 1200,
      businessName: "GreenField Tractor Rentals (Org 2)",
      businessAddress: "NH-48, GreenField Park, Hassan, Karnataka - 573201",
      phoneNumber: "+91 98450 22222",
      gstNumber: "29GREEN2222B2Z2",
      invoicePrefix: "GF-",
      currencySymbol: "₹",
      defaultTax: 0,
      invoiceNotes: "GreenField Org 2 Invoice: Thank you for choosing GreenField Rentals.",
      footerText: "GreenField Org 2 Billing Portal",
    });

    const cust1_org2 = await ctx.db.insert("customers", {
      orgId: ORG_2_ID,
      name: "Ramesh Patil (Org 2)",
      mobile: "9845099991",
      location: "Nelamangala",
      state: "Karnataka",
      notes: "GreenField harvesters regular",
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    });

    const cust2_org2 = await ctx.db.insert("customers", {
      orgId: ORG_2_ID,
      name: "Mahesh Reddi (Org 2)",
      mobile: "9845099992",
      location: "Devanahalli",
      state: "Karnataka",
      notes: "GreenField sugarcane fields",
      createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    });

    await ctx.db.insert("bills", {
      orgId: ORG_2_ID,
      invoiceNumber: "GF-00001",
      customerId: cust1_org2,
      date: todayStr,
      startTime: "07:30",
      endTime: "13:30",
      hoursUsed: 6,
      hourlyRate: 1200,
      extraCharges: [{ id: "chg-2", name: "Operator Allowance", amount: 400 }],
      discount: 200,
      grandTotal: 7400,
      status: "APPROVED",
      paymentStatus: "PAID",
      createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    });

    await ctx.db.insert("bills", {
      orgId: ORG_2_ID,
      invoiceNumber: "GF-00002",
      customerId: cust2_org2,
      date: todayStr,
      startTime: "10:00",
      endTime: "13:00",
      hoursUsed: 3,
      hourlyRate: 1200,
      extraCharges: [],
      discount: 0,
      grandTotal: 3600,
      status: "PENDING_APPROVAL",
      paymentStatus: "UNPAID",
      createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    });

    return {
      success: true,
      org1: ORG_1_ID,
      org2: ORG_2_ID,
    };
  },
});

export const resetAndSeedMinimal = mutation({
  args: {
    orgId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingBills = await ctx.db.query("bills").collect();
    for (const b of existingBills) {
      await ctx.db.delete(b._id);
    }

    const existingCustomers = await ctx.db.query("customers").collect();
    for (const c of existingCustomers) {
      await ctx.db.delete(c._id);
    }

    const existingSettings = await ctx.db.query("settings").collect();
    for (const s of existingSettings) {
      await ctx.db.delete(s._id);
    }

    await ctx.db.insert("settings", {
      orgId: args.orgId,
      hourlyRate: 1200,
      businessName: "Agro Track Machinery Services",
      businessAddress: "NH-48, Agro Junction, Hubli, Karnataka - 580020",
      phoneNumber: "+91 98765 43210",
      gstNumber: "29AAAAA1111A1Z1",
      invoicePrefix: "INV-",
      currencySymbol: "₹",
      defaultTax: 0,
      invoiceNotes: "Thank you for doing business with us! Please pay within 7 days.",
      footerText: "Powered by Agro Track Systems",
    });

    const cust1 = await ctx.db.insert("customers", {
      orgId: args.orgId,
      name: "Rajesh Gowda",
      mobile: "9845012345",
      location: "Hebbal",
      state: "Karnataka",
      notes: "Regular harvesting customer",
      createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    });

    const cust2 = await ctx.db.insert("customers", {
      orgId: args.orgId,
      name: "Suresh Kumar",
      mobile: "9845012346",
      location: "Bidadi",
      state: "Karnataka",
      notes: "Tractor attachment required",
      createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    });

    const todayStr = new Date().toISOString().split("T")[0];

    await ctx.db.insert("bills", {
      orgId: args.orgId,
      invoiceNumber: "INV-00001",
      customerId: cust1,
      date: todayStr,
      startTime: "08:00",
      endTime: "12:00",
      hoursUsed: 4,
      hourlyRate: 1200,
      extraCharges: [{ id: "chg-1", name: "Diesel Fee", amount: 500 }],
      discount: 100,
      grandTotal: 5200,
      status: "APPROVED",
      paymentStatus: "PAID",
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    });
  },
});

export const updateOrgIdForAll = mutation({
  args: {
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    const bills = await ctx.db.query("bills").collect();
    for (const b of bills) {
      await ctx.db.patch(b._id, { orgId: args.orgId });
    }

    const customers = await ctx.db.query("customers").collect();
    for (const c of customers) {
      await ctx.db.patch(c._id, { orgId: args.orgId });
    }

    const settings = await ctx.db.query("settings").collect();
    for (const s of settings) {
      await ctx.db.patch(s._id, { orgId: args.orgId });
    }
  },
});

export const seed = mutation({
  handler: async (ctx) => {
    const custCount = (await ctx.db.query("customers").collect()).length;
    if (custCount === 0) {
      await ctx.db.insert("settings", {
        hourlyRate: 1200,
        businessName: "Agro Track Machinery Services",
        businessAddress: "NH-48, Agro Junction, Hubli, Karnataka - 580020",
        phoneNumber: "+91 98765 43210",
        gstNumber: "29AAAAA1111A1Z1",
        invoicePrefix: "INV-",
        currencySymbol: "₹",
        defaultTax: 0,
        invoiceNotes: "Thank you for doing business with us! Please pay within 7 days.",
        footerText: "Powered by Agro Track Systems",
      });

      const cust1 = await ctx.db.insert("customers", {
        name: "Rajesh Gowda",
        mobile: "9845012345",
        location: "Hebbal",
        state: "Karnataka",
        notes: "Regular harvesting customer",
        createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
      });

      const todayStr = new Date().toISOString().split("T")[0];

      await ctx.db.insert("bills", {
        invoiceNumber: "INV-00001",
        customerId: cust1,
        date: todayStr,
        startTime: "08:00",
        endTime: "12:00",
        hoursUsed: 4,
        hourlyRate: 1200,
        extraCharges: [{ id: "chg-1", name: "Diesel Fee", amount: 500 }],
        discount: 100,
        grandTotal: 5200,
        status: "APPROVED",
        paymentStatus: "PAID",
        createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      });
    }
  },
});
