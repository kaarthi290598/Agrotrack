import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const appRole = v.union(
  v.literal("ADMIN"),
  v.literal("SUPERVISOR"),
  v.literal("MEMBER")
);

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    orgId: v.string(),
    email: v.string(),
    fullName: v.string(),
    imageUrl: v.optional(v.string()),
    role: appRole,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_clerkUser", ["clerkUserId"])
    .index("by_org_clerkUser", ["orgId", "clerkUserId"]),

  /**
   * Pending org invitations with the intended Convex application role.
   * Consumed when the invitee joins and their Convex user record is created.
   */
  pendingInvites: defineTable({
    orgId: v.string(),
    email: v.string(),
    role: appRole,
    invitedByClerkUserId: v.string(),
    clerkInvitationId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org_email", ["orgId", "email"]),

  customers: defineTable({
    orgId: v.optional(v.string()),
    name: v.string(),
    mobile: v.string(),
    location: v.optional(v.string()),
    state: v.optional(v.string()),
    pincode: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  bills: defineTable({
    orgId: v.optional(v.string()),
    invoiceNumber: v.string(),
    customerId: v.string(),
    customerName: v.optional(v.string()),
    customerMobile: v.optional(v.string()),
    customerLocation: v.optional(v.string()),
    customerState: v.optional(v.string()),
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
    paymentStatus: v.union(
      v.literal("PAID"),
      v.literal("UNPAID"),
      v.literal("PARTIAL_PAID")
    ),
    amountPaid: v.optional(v.number()),
    balanceAmount: v.optional(v.number()),
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
