import { createEvents, type EventAttributes } from "ics";

interface BookingData {
  id: string;
  date: string; // "2026-04-15"
  slotType: "full_day" | "am" | "pm" | "session";
  startTime?: string; // "09:00"
  endTime?: string; // "10:00"
  description?: string;
  notes?: string;
  roomName?: string;
}

export function downloadBookingIcs(booking: BookingData) {
  const [year, month, day] = booking.date.split("-").map(Number);
  const label = booking.description || booking.roomName || "Room Booking";

  let event: EventAttributes;

  if (
    booking.slotType === "session" &&
    booking.startTime &&
    booking.endTime
  ) {
    const [sh, sm] = booking.startTime.split(":").map(Number);
    const [eh, em] = booking.endTime.split(":").map(Number);
    event = {
      start: [year, month, day, sh, sm],
      end: [year, month, day, eh, em],
      title: label,
      description: booking.notes || undefined,
      status: "CONFIRMED",
      uid: booking.id,
    };
  } else if (booking.slotType === "full_day") {
    event = {
      start: [year, month, day],
      end: [year, month, day],
      title: `${label} (Full Day)`,
      description: booking.notes || undefined,
      status: "CONFIRMED",
      uid: booking.id,
    };
  } else if (booking.slotType === "am") {
    event = {
      start: [year, month, day, 8, 0],
      end: [year, month, day, 12, 0],
      title: `${label} (Morning)`,
      description: booking.notes || undefined,
      status: "CONFIRMED",
      uid: booking.id,
    };
  } else {
    event = {
      start: [year, month, day, 12, 0],
      end: [year, month, day, 17, 0],
      title: `${label} (Afternoon)`,
      description: booking.notes || undefined,
      status: "CONFIRMED",
      uid: booking.id,
    };
  }

  const { error, value } = createEvents([event]);
  if (error || !value) return;

  const blob = new Blob([value], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `booking-${booking.date}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
