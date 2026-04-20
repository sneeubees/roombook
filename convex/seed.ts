import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * DEV-ONLY: Seeds sample rooms and bookings for testing.
 */
export const seedAprilData = mutation({
  args: {
    orgId: v.id("organizations"),
    ownerClerkId: v.string(),
    ownerName: v.string(),
  },
  handler: async (ctx, args) => {
    const year = 2026;
    const month = 4; // April

    // Create 3 rooms with different configs
    const existingRooms = await ctx.db
      .query("rooms")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();

    let room1Id = existingRooms.find((r) => r.name === "Consulting Room")?._id;
    let room2Id = existingRooms.find((r) => r.name === "Physio Studio")?._id;
    let room3Id = existingRooms.find((r) => r.name === "Meeting Room")?._id;

    if (!room1Id) {
      room1Id = await ctx.db.insert("rooms", {
        orgId: args.orgId,
        name: "Consulting Room",
        description: "Ground floor, private consulting room with plinth",
        pricingMode: "hourly",
        hourlyRate: 25000, // R250/hr
        sessionDurationMinutes: 60,
        availableDays: [1, 2, 3, 4, 5], // Mon-Fri
        availabilityStart: "08:00",
        availabilityEnd: "17:00",
        amenities: ["Plinth", "Ultrasound", "Privacy"],
        isActive: true,
        sortOrder: 0,
        cancellationPolicy: "bill_if_late",
        cancellationDeadlineHours: 24,
      });
    }

    if (!room2Id) {
      room2Id = await ctx.db.insert("rooms", {
        orgId: args.orgId,
        name: "Physio Studio",
        description: "Large studio for group sessions and rehab",
        pricingMode: "day_based",
        fullDayRate: 120000, // R1200/day
        halfDayRate: 70000, // R700/half day
        availableDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
        availabilityStart: "07:00",
        availabilityEnd: "18:00",
        amenities: ["Mats", "Weights", "Mirrors", "Parking"],
        isActive: true,
        sortOrder: 1,
        cancellationPolicy: "always_free",
      });
    }

    if (!room3Id) {
      room3Id = await ctx.db.insert("rooms", {
        orgId: args.orgId,
        name: "Meeting Room",
        description: "Small meeting room for consultations and admin",
        pricingMode: "hourly",
        hourlyRate: 15000, // R150/hr
        sessionDurationMinutes: 30,
        availableDays: [1, 2, 3, 4, 5],
        availabilityStart: "09:00",
        availabilityEnd: "16:00",
        amenities: ["Whiteboard", "Projector"],
        isActive: true,
        sortOrder: 2,
        cancellationPolicy: "bill_if_late",
        cancellationDeadlineHours: 12,
      });
    }

    // Create a second booker user for variety
    const existingBooker = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", "seed_booker_sarah")
      )
      .unique();

    let sarahClerkId = "seed_booker_sarah";
    if (!existingBooker) {
      await ctx.db.insert("users", {
        clerkUserId: sarahClerkId,
        email: "sarah.jones@example.com",
        fullName: "Sarah Jones",
        phone: "0823334444",
        isProfileComplete: true,
      });
    }

    const existingBooker2 = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) =>
        q.eq("clerkUserId", "seed_booker_mike")
      )
      .unique();

    let mikeClerkId = "seed_booker_mike";
    if (!existingBooker2) {
      await ctx.db.insert("users", {
        clerkUserId: mikeClerkId,
        email: "mike.smith@example.com",
        fullName: "Mike Smith",
        phone: "0829995555",
        isProfileComplete: true,
      });
    }

    // Create ~20 bookings spread across April 2026
    const bookingTemplates = [
      // Week 1 (Mon 30 Mar - Sun 5 Apr)
      { day: 1, room: room1Id, userId: args.ownerClerkId, userName: args.ownerName, slotType: "session" as const, startTime: "09:00", endTime: "10:00", description: "John Smith — Initial consultation" },
      { day: 1, room: room1Id, userId: sarahClerkId, userName: "Sarah Jones", slotType: "session" as const, startTime: "10:30", endTime: "11:30", description: "Jane Doe — Follow-up" },
      { day: 1, room: room2Id, userId: mikeClerkId, userName: "Mike Smith", slotType: "full_day" as const, description: "Rehab group session" },
      { day: 2, room: room1Id, userId: args.ownerClerkId, userName: args.ownerName, slotType: "session" as const, startTime: "14:00", endTime: "15:30", description: "Peter Adams — Back pain assessment" },
      { day: 3, room: room3Id, userId: sarahClerkId, userName: "Sarah Jones", slotType: "session" as const, startTime: "10:00", endTime: "10:30", description: "Quick consultation" },

      // Week 2
      { day: 7, room: room1Id, userId: args.ownerClerkId, userName: args.ownerName, slotType: "session" as const, startTime: "08:00", endTime: "09:00", description: "Mary Brown — Hip therapy" },
      { day: 7, room: room2Id, userId: sarahClerkId, userName: "Sarah Jones", slotType: "am" as const, description: "Pilates group class" },
      { day: 8, room: room1Id, userId: mikeClerkId, userName: "Mike Smith", slotType: "session" as const, startTime: "13:00", endTime: "14:00", description: "Tom Wilson — Sports injury" },
      { day: 9, room: room3Id, userId: args.ownerClerkId, userName: args.ownerName, slotType: "session" as const, startTime: "11:00", endTime: "11:30", description: "Team meeting" },
      { day: 10, room: room2Id, userId: mikeClerkId, userName: "Mike Smith", slotType: "pm" as const, description: "Afternoon rehab" },

      // Week 3
      { day: 14, room: room1Id, userId: sarahClerkId, userName: "Sarah Jones", slotType: "session" as const, startTime: "09:30", endTime: "10:30", description: "Lisa Park — Posture assessment" },
      { day: 14, room: room1Id, userId: args.ownerClerkId, userName: args.ownerName, slotType: "session" as const, startTime: "11:00", endTime: "12:30", description: "David Lee — Dry needling" },
      { day: 15, room: room2Id, userId: args.ownerClerkId, userName: args.ownerName, slotType: "full_day" as const, description: "Full day workshop" },
      { day: 16, room: room3Id, userId: mikeClerkId, userName: "Mike Smith", slotType: "session" as const, startTime: "14:30", endTime: "15:00", description: "Quick admin" },
      { day: 17, room: room1Id, userId: sarahClerkId, userName: "Sarah Jones", slotType: "session" as const, startTime: "15:00", endTime: "16:00", description: "Emma White — Shoulder pain" },

      // Week 4
      { day: 21, room: room1Id, userId: args.ownerClerkId, userName: args.ownerName, slotType: "session" as const, startTime: "08:30", endTime: "09:30", description: "Robert King — Knee rehab" },
      { day: 22, room: room2Id, userId: sarahClerkId, userName: "Sarah Jones", slotType: "am" as const, description: "Morning group class" },
      { day: 23, room: room1Id, userId: mikeClerkId, userName: "Mike Smith", slotType: "session" as const, startTime: "10:00", endTime: "11:30", description: "Anna Green — Post-op physio" },
      { day: 24, room: room3Id, userId: args.ownerClerkId, userName: args.ownerName, slotType: "session" as const, startTime: "13:00", endTime: "13:30", description: "Team standup" },
      { day: 28, room: room2Id, userId: mikeClerkId, userName: "Mike Smith", slotType: "full_day" as const, description: "Corporate wellness day" },
      { day: 29, room: room1Id, userId: args.ownerClerkId, userName: args.ownerName, slotType: "session" as const, startTime: "09:00", endTime: "10:00", description: "Michael O — Neck tension" },
      { day: 30, room: room1Id, userId: sarahClerkId, userName: "Sarah Jones", slotType: "session" as const, startTime: "14:00", endTime: "15:00", description: "Paula R — Sciatica" },
    ];

    let bookingsCreated = 0;
    for (const template of bookingTemplates) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(template.day).padStart(2, "0")}`;

      // Check if already exists
      const existing = await ctx.db
        .query("bookings")
        .withIndex("by_room_date", (q) =>
          q.eq("roomId", template.room!).eq("date", date)
        )
        .collect();
      const duplicate = existing.find(
        (b) =>
          b.status === "confirmed" &&
          b.slotType === template.slotType &&
          b.startTime === (("startTime" in template ? template.startTime : undefined) ?? b.startTime) &&
          b.userId === template.userId
      );
      if (duplicate) continue;

      const room = await ctx.db.get(template.room!);
      if (!room) continue;

      let rateApplied = 0;
      if (template.slotType === "session" && "startTime" in template && "endTime" in template) {
        const [sh, sm] = template.startTime!.split(":").map(Number);
        const [eh, em] = template.endTime!.split(":").map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        rateApplied = Math.round((room.hourlyRate ?? 0) * (mins / 60));
      } else if (template.slotType === "full_day") {
        rateApplied = room.fullDayRate ?? 0;
      } else if (template.slotType === "am" || template.slotType === "pm") {
        rateApplied = room.halfDayRate ?? 0;
      }

      await ctx.db.insert("bookings", {
        orgId: args.orgId,
        roomId: template.room!,
        userId: template.userId,
        userName: template.userName,
        description: template.description,
        date,
        slotType: template.slotType,
        startTime: "startTime" in template ? template.startTime : undefined,
        endTime: "endTime" in template ? template.endTime : undefined,
        status: "confirmed",
        rateApplied,
        isBillable: true,
      });
      bookingsCreated++;
    }

    return {
      roomsCreated: existingRooms.length === 0 ? 3 : 0,
      bookingsCreated,
      totalRooms: 3,
    };
  },
});
