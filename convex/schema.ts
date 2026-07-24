import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  customers: defineTable({
    orgId: v.optional(v.string()),
    name: v.string(),
    mobile: v.string(),
    location: v.optional(v.string()),
    state: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  bills: defineTable({
    orgId: v.optional(v.string()),
    invoiceNumber: v.string(),
    customerId: v.string(),
    date: v.string(),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    hoursUsed: v.number(),
    hourlyRate: v.number(),
    extraCharges: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        amount: v.number(),
      })
    ),
    discount: v.number(),
    grandTotal: v.number(),
    status: v.union(
      v.literal("APPROVED"),
      v.literal("PENDING_APPROVAL"),
      v.literal("REJECTED"),
      v.literal("IN_PROGRESS")
    ),
    paymentStatus: v.union(v.literal("PAID"), v.literal("UNPAID")),
    createdBy: v.optional(v.string()),
    createdByEmail: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  settings: defineTable({
    orgId: v.optional(v.string()),
    hourlyRate: v.number(),
    businessName: v.string(),
    businessAddress: v.string(),
    phoneNumber: v.string(),
    gstNumber: v.optional(v.string()),
    invoicePrefix: v.string(),
    currencySymbol: v.string(),
    defaultTax: v.number(),
    invoiceNotes: v.optional(v.string()),
    footerText: v.optional(v.string()),
  }).index("by_org", ["orgId"]),
});
