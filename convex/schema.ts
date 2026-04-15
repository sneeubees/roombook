import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Organization settings (extends Clerk Organizations)
  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    invoiceDayOfMonth: v.number(), // 1-28
    invoicePrefix: v.string(), // e.g. "INV"
    currency: v.string(), // default "ZAR"
    timezone: v.string(), // default "Africa/Johannesburg"
    vatNumber: v.optional(v.string()),
    vatRate: v.number(), // default 0.15 (15%)
    bankingDetails: v.optional(
      v.object({
        bankName: v.string(),
        accountNumber: v.string(),
        branchCode: v.string(),
        accountType: v.string(),
      })
    ),
    // What staff members are called (default "Booker")
    staffLabel: v.optional(v.string()), // "Booker", "Therapist", "Physician", "Doctor", "Stylist", or custom
    // Calendar color theme
    calendarTheme: v.optional(v.string()), // "ocean", "forest", "sunset", "minimal"
    // Dark mode preference
    darkMode: v.optional(v.boolean()),
    // Whether bookers can see another booker's name (owner always sees)
    showBookerNames: v.optional(v.boolean()),
    // Whether to also show contact number (only when showBookerNames is true)
    showBookerContact: v.optional(v.boolean()),
    // Organization approval status
    status: v.optional(v.union(
      v.literal("pending_approval"),
      v.literal("active"),
      v.literal("suspended")
    )),
    // Subscription tier (defaults to "basic" in app logic)
    subscriptionTier: v.optional(
      v.union(
        v.literal("basic"),
        v.literal("professional"),
        v.literal("enterprise")
      )
    ),
  })
    .index("by_clerkOrgId", ["clerkOrgId"])
    .index("by_slug", ["slug"]),

  // User profiles
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    fullName: v.string(),
    phone: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isProfileComplete: v.optional(v.boolean()),
    isSuperAdmin: v.optional(v.boolean()),
    calendarToken: v.optional(v.string()), // Secure token for iCal feed URL
  }).index("by_clerkUserId", ["clerkUserId"]),

  // Rooms within an organization
  rooms: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    // Pricing mode: day_based (full/half day) or hourly (per session)
    pricingMode: v.union(v.literal("day_based"), v.literal("hourly")),
    fullDayRate: v.optional(v.number()), // cents, day_based only
    halfDayRate: v.optional(v.number()), // cents, day_based only
    hourlyRate: v.optional(v.number()), // cents, hourly only
    sessionDurationMinutes: v.optional(v.number()), // default session length (e.g. 60)
    // Which days the room can be booked (0=Sun, 1=Mon, ... 6=Sat). Empty = all days.
    availableDays: v.optional(v.array(v.number())),
    // Availability time window (e.g. "09:00" to "17:00"). Null = 24 hours.
    availabilityStart: v.optional(v.string()), // "HH:mm"
    availabilityEnd: v.optional(v.string()), // "HH:mm"
    amenities: v.array(v.string()),
    isActive: v.boolean(),
    sortOrder: v.number(),
    cancellationPolicy: v.union(
      v.literal("always_free"),
      v.literal("bill_if_late")
    ),
    cancellationDeadlineHours: v.optional(v.number()),
  }).index("by_org", ["orgId"]),

  // Bookings
  bookings: defineTable({
    orgId: v.id("organizations"),
    roomId: v.id("rooms"),
    userId: v.string(), // Clerk user ID — the booker this booking is FOR
    userName: v.string(), // denormalized
    description: v.optional(v.string()), // Patient name / meeting name
    bookedBy: v.optional(v.string()), // Clerk user ID of person who created booking (if on behalf)
    bookedByName: v.optional(v.string()), // denormalized name of booker
    date: v.string(), // ISO date "2026-04-14"
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("session")
    ),
    // For session (hourly) bookings — "HH:mm" format
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    status: v.union(v.literal("confirmed"), v.literal("cancelled")),
    rateApplied: v.number(), // snapshot at booking time (cents)
    isBillable: v.boolean(),
    cancelledAt: v.optional(v.number()),
    cancelledBy: v.optional(v.string()),
    cancellationReason: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_room_date", ["roomId", "date"])
    .index("by_user_date", ["userId", "date"])
    .index("by_org_date", ["orgId", "date"])
    .index("by_org_user_status", ["orgId", "userId", "status"])
    .index("by_org_status", ["orgId", "status"]),

  // Owner-initiated room blocks
  roomBlocks: defineTable({
    orgId: v.id("organizations"),
    roomId: v.id("rooms"),
    blockedBy: v.string(), // Clerk user ID
    startDate: v.string(),
    endDate: v.string(),
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("time_range")
    ),
    // For time_range blocks on hourly rooms
    startTime: v.optional(v.string()), // "HH:mm"
    endTime: v.optional(v.string()), // "HH:mm"
    reason: v.optional(v.string()),
  })
    .index("by_room", ["roomId"])
    .index("by_org", ["orgId"]),

  // Waitlist for booked slots
  waitlist: defineTable({
    orgId: v.id("organizations"),
    roomId: v.id("rooms"),
    userId: v.string(),
    date: v.string(),
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("session")
    ),
    // For session waitlist entries
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

  // Invoices
  invoices: defineTable({
    orgId: v.id("organizations"),
    userId: v.string(), // Clerk user ID
    invoiceNumber: v.string(),
    periodStart: v.string(),
    periodEnd: v.string(),
    subtotal: v.number(), // cents
    taxRate: v.number(),
    taxAmount: v.number(),
    total: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue"),
      v.literal("void")
    ),
    pdfStorageId: v.optional(v.id("_storage")),
    sentAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    dueDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user_period", ["orgId", "userId", "periodStart"])
    .index("by_invoiceNumber", ["invoiceNumber"]),

  // Invoice line items
  invoiceLineItems: defineTable({
    invoiceId: v.id("invoices"),
    bookingId: v.id("bookings"),
    roomName: v.string(), // denormalized snapshot
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
    rate: v.number(), // cents
    amount: v.number(), // cents
  }).index("by_invoice", ["invoiceId"]),

  // Invitations
  invitations: defineTable({
    orgId: v.id("organizations"),
    clerkOrgId: v.string(),
    invitedBy: v.string(), // Clerk user ID
    email: v.string(),
    role: v.union(v.literal("therapist"), v.literal("owner")),
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
    .index("by_org", ["orgId"]),

  // Notifications
  notifications: defineTable({
    userId: v.string(), // Clerk user ID
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

  // White-label domain mapping (Phase 2)
  domains: defineTable({
    orgId: v.id("organizations"),
    domain: v.string(),
    isVerified: v.boolean(),
    verifiedAt: v.optional(v.number()),
  }).index("by_domain", ["domain"]),
});
