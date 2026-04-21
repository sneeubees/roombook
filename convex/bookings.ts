import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

// Helper: check if two time ranges overlap (exclusive end)
function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export const listByRoomAndDateRange = query({
  args: {
    orgId: v.id("organizations"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_org_status", (q) =>
        q.eq("orgId", args.orgId).eq("status", "confirmed")
      )
      .collect();

    return bookings.filter(
      (b) => b.date >= args.startDate && b.date <= args.endDate
    );
  },
});

export const listAllByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_user_date", (q) => q.eq("userId", args.userId))
      .collect()
      .then((bookings) => bookings.filter((b) => b.status === "confirmed"));
  },
});

export const listByUser = query({
  args: {
    userId: v.id("users"),
    orgId: v.id("organizations"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_org_user_status", (q) =>
        q
          .eq("orgId", args.orgId)
          .eq("userId", args.userId)
          .eq("status", "confirmed")
      )
      .collect();

    if (args.startDate && args.endDate) {
      return bookings.filter(
        (b) => b.date >= args.startDate! && b.date <= args.endDate!
      );
    }
    return bookings;
  },
});

export const listAllByOrg = query({
  args: {
    orgId: v.id("organizations"),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("confirmed"), v.literal("cancelled"))
    ),
  },
  handler: async (ctx, args) => {
    let bookings;
    if (args.status) {
      bookings = await ctx.db
        .query("bookings")
        .withIndex("by_org_status", (q) =>
          q.eq("orgId", args.orgId).eq("status", args.status!)
        )
        .collect();
    } else {
      bookings = await ctx.db
        .query("bookings")
        .withIndex("by_org_date", (q) => q.eq("orgId", args.orgId))
        .collect();
    }

    if (args.startDate && args.endDate) {
      return bookings.filter(
        (b) => b.date >= args.startDate! && b.date <= args.endDate!
      );
    }

    return bookings;
  },
});

export const create = mutation({
  args: {
    orgId: v.id("organizations"),
    roomId: v.id("rooms"),
    // Optional: book on behalf of another user. If omitted, it's self-booking.
    forUserId: v.optional(v.id("users")),
    description: v.optional(v.string()),
    date: v.string(),
    slotType: v.union(
      v.literal("full_day"),
      v.literal("am"),
      v.literal("pm"),
      v.literal("session")
    ),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");

    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (!room.isActive) throw new Error("Room is not active");

    // Determine who the booking is for
    const targetUserId: Id<"users"> = args.forUserId ?? actorId;

    if (args.forUserId && args.forUserId !== actorId) {
      // Booking on behalf of someone — only owner / manager / super admin allowed.
      const actorMembership = await ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q) =>
          q.eq("orgId", args.orgId).eq("userId", actorId)
        )
        .unique();
      const actorProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", actorId))
        .unique();
      const isPrivileged =
        actorProfile?.isSuperAdmin === true ||
        actorMembership?.role === "owner" ||
        actorMembership?.role === "manager";
      if (!isPrivileged) {
        throw new Error(
          "Only an owner, manager, or super admin can book on behalf of another user"
        );
      }
    }

    const targetUser = await ctx.db.get(targetUserId);
    if (!targetUser) throw new Error("Target user not found");
    const targetUserName =
      (targetUser as { name?: string }).name ??
      (targetUser as { email?: string }).email ??
      "Unknown";

    let bookedBy: Id<"users"> | undefined;
    let bookedByName: string | undefined;
    if (args.forUserId && args.forUserId !== actorId) {
      const actor = await ctx.db.get(actorId);
      bookedBy = actorId;
      bookedByName =
        (actor as { name?: string } | null)?.name ??
        (actor as { email?: string } | null)?.email ??
        "Owner";
    }

    if (room.availableDays && room.availableDays.length > 0) {
      const bookingDate = new Date(args.date + "T12:00:00");
      const dayOfWeek = bookingDate.getDay();
      if (!room.availableDays.includes(dayOfWeek)) {
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        throw new Error(`This room is not available on ${dayNames[dayOfWeek]}s`);
      }
    }

    const existingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_room_date", (q) =>
        q.eq("roomId", args.roomId).eq("date", args.date)
      )
      .collect();
    const confirmedBookings = existingBookings.filter(
      (b) => b.status === "confirmed"
    );

    const blocks = await ctx.db
      .query("roomBlocks")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    const dayBlocks = blocks.filter(
      (b) => args.date >= b.startDate && args.date <= b.endDate
    );

    let rateApplied: number;
    let startTime = args.startTime;
    let endTime = args.endTime;

    if (room.pricingMode === "hourly") {
      if (args.slotType !== "session") {
        throw new Error("Hourly rooms only support session bookings");
      }
      if (!startTime || !endTime) {
        throw new Error("Start time and end time are required for session bookings");
      }
      if (startTime >= endTime) {
        throw new Error("Start time must be before end time");
      }
      if (room.availabilityStart && startTime < room.availabilityStart) {
        throw new Error(`Room is not available before ${room.availabilityStart}`);
      }
      if (room.availabilityEnd && endTime > room.availabilityEnd) {
        throw new Error(`Room is not available after ${room.availabilityEnd}`);
      }

      for (const booking of confirmedBookings) {
        if (booking.slotType === "session" && booking.startTime && booking.endTime) {
          if (timesOverlap(startTime, endTime, booking.startTime, booking.endTime)) {
            throw new Error(
              `Overlaps with existing booking (${booking.startTime}–${booking.endTime})`
            );
          }
        }
      }

      for (const block of dayBlocks) {
        if (block.slotType === "full_day") {
          throw new Error("Room is blocked for this entire day");
        }
        if (block.slotType === "time_range" && block.startTime && block.endTime) {
          if (timesOverlap(startTime, endTime, block.startTime, block.endTime)) {
            throw new Error(
              `Overlaps with block (${block.startTime}–${block.endTime})`
            );
          }
        }
      }

      const duration = durationMinutes(startTime, endTime);
      rateApplied = Math.round((room.hourlyRate ?? 0) * (duration / 60));
    } else {
      if (args.slotType === "session") {
        throw new Error("Day-based rooms do not support session bookings");
      }

      if (args.slotType === "full_day") {
        if (confirmedBookings.length > 0) {
          throw new Error("Room is already booked for this date");
        }
      } else {
        const hasFullDay = confirmedBookings.some((b) => b.slotType === "full_day");
        const hasSameSlot = confirmedBookings.some((b) => b.slotType === args.slotType);
        if (hasFullDay) throw new Error("Room is booked for the full day");
        if (hasSameSlot) {
          throw new Error(
            `Room is already booked for the ${args.slotType === "am" ? "morning" : "afternoon"}`
          );
        }
      }

      const isBlocked = dayBlocks.some((block) => {
        if (block.slotType === "full_day") return true;
        if (args.slotType === "full_day") return true;
        return block.slotType === args.slotType;
      });
      if (isBlocked) throw new Error("Room is blocked for this slot");

      rateApplied =
        args.slotType === "full_day"
          ? (room.fullDayRate ?? 0)
          : (room.halfDayRate ?? 0);
    }

    const bookingId = await ctx.db.insert("bookings", {
      orgId: args.orgId,
      roomId: args.roomId,
      userId: targetUserId,
      userName: targetUserName,
      description: args.description,
      bookedBy,
      bookedByName,
      date: args.date,
      slotType: args.slotType,
      startTime,
      endTime,
      status: "confirmed",
      rateApplied,
      isBillable: true,
      notes: args.notes,
    });

    await ctx.scheduler.runAfter(0, internal.emailActions.sendBookingConfirmation, {
      bookingId,
    });

    const actor = await ctx.db.get(actorId);
    await ctx.db.insert("activityLogs", {
      orgId: args.orgId,
      actorId,
      actorName:
        (actor as { name?: string } | null)?.name ??
        (actor as { email?: string } | null)?.email ??
        "Unknown",
      actorRole: bookedBy ? "owner_or_manager" : "booker",
      action: "booking_created",
      targetType: "booking",
      targetId: bookingId,
      targetName: `${room.name} on ${args.date}`,
      details: {
        forUserName: targetUserName,
        onBehalf: !!bookedBy,
        description: args.description,
        slotType: args.slotType,
        startTime,
        endTime,
      },
    });

    return bookingId;
  },
});

export const cancel = mutation({
  args: {
    id: v.id("bookings"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");

    const booking = await ctx.db.get(args.id);
    if (!booking) throw new Error("Booking not found");
    if (booking.status === "cancelled") throw new Error("Already cancelled");

    const room = await ctx.db.get(booking.roomId);
    let isBillable = false;
    if (room && room.cancellationPolicy === "bill_if_late") {
      const deadlineHours = room.cancellationDeadlineHours ?? 24;
      const bookingDate = new Date(booking.date);
      const deadline = new Date(
        bookingDate.getTime() - deadlineHours * 60 * 60 * 1000
      );
      if (new Date() > deadline) isBillable = true;
    }

    await ctx.db.patch(args.id, {
      status: "cancelled",
      cancelledAt: Date.now(),
      cancelledBy: actorId,
      cancellationReason: args.reason,
      isBillable,
    });

    const slotLabel =
      booking.slotType === "session" && booking.startTime && booking.endTime
        ? `${booking.startTime}–${booking.endTime}`
        : booking.slotType === "full_day"
          ? "Full Day"
          : booking.slotType.toUpperCase();
    const roomName = room?.name ?? "Unknown Room";

    if (actorId !== booking.userId) {
      await ctx.db.insert("notifications", {
        userId: booking.userId,
        orgId: booking.orgId,
        type: "booking_cancelled",
        title: "Booking Cancelled",
        message: `Your booking for ${roomName} on ${booking.date} (${slotLabel}) has been cancelled.`,
        metadata: {
          roomId: booking.roomId,
          date: booking.date,
          slotType: booking.slotType,
        },
        isRead: false,
        emailSent: false,
      });
    } else {
      await ctx.db.insert("notifications", {
        userId: "org_owners",
        orgId: booking.orgId,
        type: "booking_cancelled",
        title: "Booking Cancelled",
        message: `${booking.userName} cancelled their booking for ${roomName} on ${booking.date} (${slotLabel}).`,
        metadata: {
          roomId: booking.roomId,
          date: booking.date,
          slotType: booking.slotType,
          bookerName: booking.userName,
        },
        isRead: false,
        emailSent: false,
      });
    }

    // Notify waitlisted users
    let waitlistEntries;
    if (booking.slotType === "session") {
      const allEntries = await ctx.db
        .query("waitlist")
        .withIndex("by_room_date_slot", (q) =>
          q.eq("roomId", booking.roomId).eq("date", booking.date).eq("slotType", "session")
        )
        .collect();
      waitlistEntries = allEntries.filter((w) => w.status === "waiting");
    } else {
      const entries = await ctx.db
        .query("waitlist")
        .withIndex("by_room_date_slot", (q) =>
          q.eq("roomId", booking.roomId).eq("date", booking.date).eq("slotType", booking.slotType)
        )
        .collect();
      waitlistEntries = entries.filter((w) => w.status === "waiting");
    }

    for (const entry of waitlistEntries) {
      await ctx.db.patch(entry._id, {
        status: "notified",
        notifiedAt: Date.now(),
      });
      await ctx.db.insert("notifications", {
        userId: entry.userId,
        orgId: booking.orgId,
        type: "waitlist_available",
        title: "Room Available!",
        message: `A slot has opened up for ${booking.date} (${slotLabel}).`,
        metadata: {
          roomId: booking.roomId,
          date: booking.date,
          slotType: booking.slotType,
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
        isRead: false,
        emailSent: false,
      });
    }

    const actor = await ctx.db.get(actorId);
    const actorName =
      (actor as { name?: string } | null)?.name ??
      (actor as { email?: string } | null)?.email ??
      "Unknown";

    await ctx.scheduler.runAfter(0, internal.emailActions.sendBookingCancellation, {
      bookingId: args.id,
      cancelledByName: actorName,
      reason: args.reason,
      isBillable,
    });

    const room2 = await ctx.db.get(booking.roomId);
    const org2 = await ctx.db.get(booking.orgId);
    for (const entry of waitlistEntries) {
      await ctx.scheduler.runAfter(0, internal.emailActions.sendWaitlistNotification, {
        userId: entry.userId,
        roomName: room2?.name ?? "Unknown Room",
        date: booking.date,
        slot: slotLabel,
        orgName: org2?.name ?? "Unknown",
      });
    }

    await ctx.db.insert("activityLogs", {
      orgId: booking.orgId,
      actorId,
      actorName,
      actorRole: actorId === booking.userId ? "booker" : "owner_or_manager",
      action: "booking_cancelled",
      targetType: "booking",
      targetId: args.id,
      targetName: `${room2?.name ?? "Room"} on ${booking.date}`,
      details: {
        forUserName: booking.userName,
        reason: args.reason,
        isBillable,
        waitlistNotified: waitlistEntries.length,
      },
    });

    return { isBillable, waitlistNotified: waitlistEntries.length };
  },
});

export const update = mutation({
  args: {
    id: v.id("bookings"),
    startTime: v.string(),
    endTime: v.string(),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");

    const booking = await ctx.db.get(args.id);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "confirmed") throw new Error("Booking is not active");
    if (booking.slotType !== "session") throw new Error("Only session bookings can be updated");
    if (args.startTime >= args.endTime) throw new Error("Start time must be before end time");

    const room = await ctx.db.get(booking.roomId);
    if (!room) throw new Error("Room not found");
    if (room.availabilityStart && args.startTime < room.availabilityStart) {
      throw new Error(`Room is not available before ${room.availabilityStart}`);
    }
    if (room.availabilityEnd && args.endTime > room.availabilityEnd) {
      throw new Error(`Room is not available after ${room.availabilityEnd}`);
    }

    const existingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_room_date", (q) =>
        q.eq("roomId", booking.roomId).eq("date", booking.date)
      )
      .collect();
    const otherConfirmed = existingBookings.filter(
      (b) => b.status === "confirmed" && b._id !== args.id
    );
    for (const other of otherConfirmed) {
      if (other.slotType === "session" && other.startTime && other.endTime) {
        if (timesOverlap(args.startTime, args.endTime, other.startTime, other.endTime)) {
          throw new Error(`Overlaps with booking (${other.startTime}–${other.endTime})`);
        }
      }
    }

    const blocks = await ctx.db
      .query("roomBlocks")
      .withIndex("by_room", (q) => q.eq("roomId", booking.roomId))
      .collect();
    const dayBlocks = blocks.filter(
      (b) => booking.date >= b.startDate && booking.date <= b.endDate
    );
    for (const block of dayBlocks) {
      if (block.slotType === "full_day") {
        throw new Error("Room is blocked for this entire day");
      }
      if (block.slotType === "time_range" && block.startTime && block.endTime) {
        if (timesOverlap(args.startTime, args.endTime, block.startTime, block.endTime)) {
          throw new Error(`Overlaps with block (${block.startTime}–${block.endTime})`);
        }
      }
    }

    const duration = durationMinutes(args.startTime, args.endTime);
    const rateApplied = Math.round((room.hourlyRate ?? 0) * (duration / 60));

    const oldStart = booking.startTime ?? "";
    const oldEnd = booking.endTime ?? "";
    const wasReduced = args.startTime > oldStart || args.endTime < oldEnd;

    await ctx.db.patch(args.id, {
      startTime: args.startTime,
      endTime: args.endTime,
      rateApplied,
    });

    let waitlistNotified = 0;
    if (wasReduced) {
      const entries = await ctx.db
        .query("waitlist")
        .withIndex("by_room_date_slot", (q) =>
          q.eq("roomId", booking.roomId).eq("date", booking.date).eq("slotType", "session")
        )
        .collect();
      for (const entry of entries.filter((w) => w.status === "waiting")) {
        await ctx.db.patch(entry._id, { status: "notified", notifiedAt: Date.now() });
        await ctx.db.insert("notifications", {
          userId: entry.userId,
          orgId: booking.orgId,
          type: "waitlist_available",
          title: "Time Slot Updated!",
          message: `A booking was reduced for ${booking.date}. New availability may exist.`,
          metadata: {
            roomId: booking.roomId,
            date: booking.date,
            slotType: "session",
          },
          isRead: false,
          emailSent: false,
        });
        waitlistNotified++;
      }
    }

    return { rateApplied, waitlistNotified };
  },
});

export const editDetails = mutation({
  args: {
    id: v.id("bookings"),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    slotType: v.optional(
      v.union(
        v.literal("full_day"),
        v.literal("am"),
        v.literal("pm"),
        v.literal("session")
      )
    ),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");

    const booking = await ctx.db.get(args.id);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "confirmed") throw new Error("Cannot edit a cancelled booking");

    const room = await ctx.db.get(booking.roomId);

    const updates: Record<string, unknown> = {};
    if (args.description !== undefined) updates.description = args.description || undefined;
    if (args.notes !== undefined) updates.notes = args.notes || undefined;

    const newSlotType = args.slotType ?? booking.slotType;
    const newStartTime = args.startTime ?? booking.startTime;
    const newEndTime = args.endTime ?? booking.endTime;

    if (args.slotType && args.slotType !== booking.slotType) {
      updates.slotType = args.slotType;
    }

    if (newSlotType === "session" && (args.startTime || args.endTime)) {
      const st = newStartTime ?? "09:00";
      const et = newEndTime ?? "10:00";
      if (st >= et) throw new Error("Start time must be before end time");
      if (room?.availabilityStart && st < room.availabilityStart) {
        throw new Error(`Room not available before ${room.availabilityStart}`);
      }
      if (room?.availabilityEnd && et > room.availabilityEnd) {
        throw new Error(`Room not available after ${room.availabilityEnd}`);
      }
      const existingBookings = await ctx.db
        .query("bookings")
        .withIndex("by_room_date", (q) =>
          q.eq("roomId", booking.roomId).eq("date", booking.date)
        )
        .collect();
      for (const other of existingBookings) {
        if (other._id === args.id || other.status !== "confirmed") continue;
        if (other.slotType === "session" && other.startTime && other.endTime) {
          if (timesOverlap(st, et, other.startTime, other.endTime)) {
            throw new Error(`Overlaps with booking (${other.startTime}–${other.endTime})`);
          }
        }
      }
      updates.startTime = st;
      updates.endTime = et;
      const duration = durationMinutes(st, et);
      updates.rateApplied = Math.round((room?.hourlyRate ?? 0) * (duration / 60));
    } else if (newSlotType !== "session" && args.slotType) {
      updates.rateApplied =
        newSlotType === "full_day"
          ? (room?.fullDayRate ?? 0)
          : (room?.halfDayRate ?? 0);
      updates.startTime = undefined;
      updates.endTime = undefined;
    }

    await ctx.db.patch(args.id, updates);

    const actor = await ctx.db.get(actorId);
    await ctx.db.insert("activityLogs", {
      orgId: booking.orgId,
      actorId,
      actorName:
        (actor as { name?: string } | null)?.name ??
        (actor as { email?: string } | null)?.email ??
        "Unknown",
      actorRole: actorId === booking.userId ? "booker" : "owner_or_manager",
      action: "booking_edited",
      targetType: "booking",
      targetId: args.id,
      targetName: `${room?.name ?? "Room"} on ${booking.date}`,
      details: {
        forUserName: booking.userName,
        changedFields: Object.keys(updates),
      },
    });

    return true;
  },
});

export const setExcludeFromInvoice = mutation({
  args: {
    id: v.id("bookings"),
    exclude: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actorId = await getAuthUserId(ctx);
    if (!actorId) throw new Error("Not authenticated");

    const booking = await ctx.db.get(args.id);
    if (!booking) throw new Error("Booking not found");

    const lineItems = await ctx.db.query("invoiceLineItems").collect();
    const matching = lineItems.filter((li) => li.bookingId === args.id);
    let wasInvoiced = false;
    for (const li of matching) {
      const inv = await ctx.db.get(li.invoiceId);
      if (inv && inv.status !== "cancelled") {
        wasInvoiced = true;
        break;
      }
    }

    await ctx.db.patch(args.id, { excludeFromInvoice: args.exclude });

    const actor = await ctx.db.get(actorId);
    await ctx.db.insert("activityLogs", {
      orgId: booking.orgId,
      actorId,
      actorName:
        (actor as { name?: string } | null)?.name ??
        (actor as { email?: string } | null)?.email ??
        "Unknown",
      actorRole: actorId === booking.userId ? "booker" : "owner_or_manager",
      action: args.exclude ? "booking_invoice_excluded" : "booking_invoice_included",
      targetType: "booking",
      targetId: args.id,
      targetName: `Booking on ${booking.date}`,
      details: { wasInvoiced },
    });

    return { wasInvoiced };
  },
});

export const getInvoicedBookingIds = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
    const activeInvoiceIds = new Set(
      invoices.filter((i) => i.status !== "cancelled").map((i) => i._id)
    );
    const lineItems = await ctx.db.query("invoiceLineItems").collect();
    const bookingIds = new Set<string>();
    for (const li of lineItems) {
      if (activeInvoiceIds.has(li.invoiceId)) {
        bookingIds.add(li.bookingId);
      }
    }
    return Array.from(bookingIds);
  },
});
