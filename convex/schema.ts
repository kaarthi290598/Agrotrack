import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const appRole = v.union(
  v.literal("ADMIN"),
  v.literal("BUSINESS_OPERATIONS_LEAD"),
  v.literal("SUPERVISOR")
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
    .index("by_org_clerkUser", ["orgId", "clerkUserId"])
    .index("by_org_email", ["orgId", "email"]),

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

  /**
   * Blocks sync/webhook from recreating a member right after deliberate removal
   * (Clerk membership list can lag and would otherwise re-insert the row).
   */
  removedMemberships: defineTable({
    orgId: v.string(),
    clerkUserId: v.string(),
    removedAt: v.number(),
  }).index("by_org_clerkUser", ["orgId", "clerkUserId"]),

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
    /** Assigned only when paymentStatus becomes PAID; never regenerated. */
    invoiceNumber: v.optional(v.string()),
    /** Estimated Running Cost — required on new writes; optional for legacy rows. */
    ertNumber: v.optional(v.string()),
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
    /** Required on new Fully Paid writes; optional for legacy paid bills. */
    paymentMode: v.optional(
      v.union(v.literal("CASH"), v.literal("ONLINE"))
    ),
    amountPaid: v.optional(v.number()),
    balanceAmount: v.optional(v.number()),
    createdBy: v.optional(v.string()),
    createdByEmail: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_invoiceNumber", ["orgId", "invoiceNumber"])
    .index("by_org_ertNumber", ["orgId", "ertNumber"]),

  settings: defineTable({
    orgId: v.optional(v.string()),
    hourlyRate: v.number(),
    businessName: v.string(),
    businessAddress: v.string(),
    phoneNumber: v.string(),
    gstNumber: v.optional(v.string()),
    invoicePrefix: v.string(),
    /** Next sequence integer to assign (padded under prefix). */
    nextInvoiceNumber: v.optional(v.number()),
    /** Digit width for padded sequence (3–8). Default 5. */
    invoiceNumberDigits: v.optional(v.number()),
    currencySymbol: v.string(),
    defaultTax: v.number(),
    invoiceNotes: v.optional(v.string()),
    footerText: v.optional(v.string()),
    /** Org-level HSN/SAC code printed on Tax Invoice line items. */
    hsnCode: v.optional(v.string()),
    /** Convex file storage id for invoice logo (PNG/SVG). */
    logoStorageId: v.optional(v.id("_storage")),
  }).index("by_org", ["orgId"]),
});
