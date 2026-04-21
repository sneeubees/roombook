import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { createEvents, type EventAttributes } from "ics";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Look up user by calendar token
  const user = await convex.query(api.users.getByCalendarToken, { token });
  if (!user) {
    return new Response("Invalid calendar token", { status: 404 });
  }

  // Get all confirmed bookings for this user
  const bookings = await convex.query(api.bookings.listAllByUser, {
    userId: user._id,
  });

  const events: EventAttributes[] = [];

  for (const booking of bookings) {
    const [year, month, day] = booking.date.split("-").map(Number);
    const label = booking.description || "Room Booking";

    if (
      booking.slotType === "session" &&
      booking.startTime &&
      booking.endTime
    ) {
      const [sh, sm] = booking.startTime.split(":").map(Number);
      const [eh, em] = booking.endTime.split(":").map(Number);
      events.push({
        start: [year, month, day, sh, sm],
        end: [year, month, day, eh, em],
        title: label,
        description: booking.notes || undefined,
        status: "CONFIRMED",
        uid: booking._id,
      });
    } else if (booking.slotType === "full_day") {
      events.push({
        start: [year, month, day],
        end: [year, month, day],
        title: `${label} (Full Day)`,
        description: booking.notes || undefined,
        status: "CONFIRMED",
        uid: booking._id,
      });
    } else if (booking.slotType === "am") {
      events.push({
        start: [year, month, day, 8, 0],
        end: [year, month, day, 12, 0],
        title: `${label} (Morning)`,
        description: booking.notes || undefined,
        status: "CONFIRMED",
        uid: booking._id,
      });
    } else if (booking.slotType === "pm") {
      events.push({
        start: [year, month, day, 12, 0],
        end: [year, month, day, 17, 0],
        title: `${label} (Afternoon)`,
        description: booking.notes || undefined,
        status: "CONFIRMED",
        uid: booking._id,
      });
    }
  }

  if (events.length === 0) {
    // Return empty calendar
    const ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//RoomBook//EN",
      "X-WR-CALNAME:RoomBook",
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(ical, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  const { error, value } = createEvents(events);

  if (error || !value) {
    return new Response("Failed to generate calendar", { status: 500 });
  }

  return new Response(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
