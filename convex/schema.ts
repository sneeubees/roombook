import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Convex Auth tables — users, authAccounts, authSessions, etc.
  ...authTables,

  // Extra per-user profile data that augments the Convex Auth `users` row.
  // Keyed by the Convex Auth userId.
  userProfiles: defineTable({
    userId: v.id("users"),
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isProfileComplete: v.optional(v.boolean()),
    isSuperAdmin: v.optional(v.boolean()),
    calendarToken: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_calendarToken", ["calendarToken"]),

  // Organization settings.
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    invoicesEnabled: v.optional(v.boolean()),
    invoiceMode: v.optional(v.union(v.literal("auto"), v.literal("manual"))),
    invoiceDayOfMonth: v.number(),
    invoicePrefix: v.string(),
    currency: v.string(),
    timezone: v.string(),
    vatNumber: v.optional(v.string()),
    vatRate: v.number(),
    bankingDetails: v.optional(
      v.object({
        bankName: v.string(),
        accountNumber: v.string(),
        branchCode: v.string(),
        accountType: v.string(),
      })
    ),
    staffLabel: v.optional(v.string()),
    calendarTheme: v.optional(v.string()),
    darkMode: v.optional(v.boolean()),
    showBookerNames: v.optional(v.boolean()),
    showBookerContact: v.optional(v.boolean()),
    status: v.optional(
      v.union(
        v.literal("pending_approval"),
        v.literal("active"),
        v.literal("suspended")
      )
    ),
    subscriptionTier: v.optional(
      v.union(
        v.literal("basic"),
        v.literal("professional"),
        v.literal("enterprise")
      )
    ),
    // The Convex Auth userId of the owner (one per org).
    ownerUserId: v.optional(v.id("users")),
  }).index("by_slug", ["slug"]),

  // Membership — links a user to an organisation with a role.
  memberships: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("manager"), v.literal("booker")),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"]),

  // Rooms.
  rooms: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    pricingMode: v.union(v.literal("day_based"), v.literal("hourly")),
    fullDayRate: v.optional(v.number()),
    halfDayRate: v.optional(v.number()),
    hourlyRate: v.optional(v.number()),
    sessionDurationMinutes: v.optional(v.number()),
    availableDays: v.optional(v.array(v.number())),
    availabilityStart: v.optional(v.string()),
    availabilityEnd: v.optional(v.string()),
    amenities: v.array(v.string()),
    isActive: v.boolean(),
    sortOrder: v.number(),
    cancellationPolicy: v.union(
      v.literal("always_free"),
      v.literal("bill_if_late")
    ),
    cancellationDeadlineHours: v.optional(v.number()),
  }).index("by_org", ["orgId"]),

  // Bookings.
  bookings: defineTable({
    orgId: v.id("organizations"),
    roomId: v.id("rooms"),
    userId: v.id("users"),
    userName: v.string(),
    description: v.optional(v.string()),
    bookedBy: v.optional(v.id("users")),
    bookedByName: v.optional(v.string()),
    date: v.string(),
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("session")
    ),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    status: v.union(v.literal("confirmed"), v.literal("cancelled")),
    rateApplied: v.number(),
    isBillable: v.boolean(),
    cancelledAt: v.optional(v.number()),
    cancelledBy: v.optional(v.id("users")),
    cancellationReason: v.optional(v.string()),
    notes: v.optional(v.string()),
    excludeFromInvoice: v.optional(v.boolean()),
  })
    .index("by_room_date", ["roomId", "date"])
    .index("by_user_date", ["userId", "date"])
    .index("by_org_date", ["orgId", "date"])
    .index("by_org_user_status", ["orgId", "userId", "status"])
    .index("by_org_status", ["orgId", "status"]),

  // Owner-initiated room blocks.
  roomBlocks: defineTable({
    orgId: v.id("organizations"),
    roomId: v.id("rooms"),
    blockedBy: v.id("users"),
    startDate: v.string(),
    endDate: v.string(),
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("time_range")
    ),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    reason: v.optional(v.string()),
  })
    .index("by_room", ["roomId"])
    .index("by_org", ["orgId"]),

  // Waitlist.
  waitlist: defineTable({
    orgId: v.id("organizations"),
    roomId: v.id("rooms"),
    userId: v.id("users"),
    date: v.string(),
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("session")
    ),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    status: v.union(
      v.literal("waiting"),
      v.literal("notified"),
      v.literal("expired"),
      v.literal("booked")
    ),
    notifiedAt: v.optional(v.number()),
  })
    .index("by_room_date_slot", ["roomId", "date", "slotType"])
    .index("by_user", ["userId"]),

  // Invoices.
  invoices: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    invoiceNumber: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    subtotal: v.number(),
    taxRate: v.number(),
    taxAmount: v.number(),
    total: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("void"),
      v.literal("cancelled")
    ),
    pdfStorageId: v.optional(v.id("_storage")),
    sentAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    cancelledAt: v.optional(v.number()),
    cancelledReason: v.optional(v.string()),
    replacedByInvoiceId: v.optional(v.id("invoices")),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user_period", ["orgId", "userId", "periodStart"])
    .index("by_org_period", ["orgId", "periodStart"])
    .index("by_invoiceNumber", ["invoiceNumber"]),

  // Invoice line items.
  invoiceLineItems: defineTable({
    invoiceId: v.id("invoices"),
    bookingId: v.id("bookings"),
    roomName: v.string(),
    date: v.string(),
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("session")
    ),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    description: v.optional(v.string()),
    bookedByName: v.optional(v.string()),
    rate: v.number(),
    amount: v.number(),
  }).index("by_invoice", ["invoiceId"]),

  // Invitations — tokenised invite link for adding a user to an org.
  invitations: defineTable({
    orgId: v.id("organizations"),
    invitedBy: v.id("users"),
    email: v.string(),
    role: v.union(v.literal("manager"), v.literal("booker")),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("revoked")
    ),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_org", ["orgId"])
    .index("by_email", ["email"]),

  // Notifications.
  notifications: defineTable({
    userId: v.union(v.id("users"), v.string()),
    orgId: v.id("organizations"),
    type: v.union(
      v.literal("waitlist_available"),
      v.literal("booking_confirmed"),
      v.literal("booking_cancelled"),
      v.literal("invoice_generated"),
      v.literal("invitation_received")
    ),
    title: v.string(),
    message: v.string(),
    metadata: v.optional(v.any()),
    isRead: v.boolean(),
    emailSent: v.boolean(),
  })
    .index("by_user_unread", ["userId", "isRead"])
    .index("by_org", ["orgId"]),

  // White-label domain mapping.
  domains: defineTable({
    orgId: v.id("organizations"),
    domain: v.string(),
    isVerified: v.boolean(),
    verifiedAt: v.optional(v.number()),
  }).index("by_domain", ["domain"]),

  // Activity log — audit trail.
  activityLogs: defineTable({
    orgId: v.id("organizations"),
    actorId: v.id("users"),
    actorName: v.string(),
    actorRole: v.string(),
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    targetName: v.optional(v.string()),
    details: v.optional(v.any()),
  })
    .index("by_org", ["orgId"])
    .index("by_actor", ["actorId"]),
});
