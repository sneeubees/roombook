"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import { useState, useCallback, useMemo, useEffect } from "react";
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  isBefore,
} from "date-fns";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getThemeColors } from "@/lib/calendar-themes";
import { getRoomColor } from "@/lib/room-colors";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { UnverifiedDomainsBanner } from "@/components/unverified-domains-banner";

type SlotType = "full_day" | "am" | "pm" | "session";

// Generate time options in 30-min increments
function generateTimeOptions(start?: string, end?: string) {
  const options: { value: string; label: string }[] = [];
  const startHour = start ? parseInt(start.split(":")[0]) : 0;
  const endHour = end ? parseInt(end.split(":")[0]) : 24;
  for (let h = startHour; h <= endHour; h++) {
    for (const m of [0, 30]) {
      if (h === endHour && m > 0) break;
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      options.push({ value: val, label: val });
    }
  }
  return options;
}

function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

function durationLabel(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (remainMins === 0) return `${hours}h`;
  return `${hours}h ${remainMins}m`;
}

export default function CalendarPage() {
  const me = useQuery(api.users.currentUser);
  const { orgId, convexOrg } = useOrgData();
  const { isOwner, canManage } = useUserRole();
  // Owners, managers, and super admins always see booker names. The
  // `showBookerNames` setting only affects bookers.
  const showNames = canManage || (convexOrg?.showBookerNames ?? false);
  const tc = getThemeColors(convexOrg?.calendarTheme);

  // Get room color by room ID — uses sortOrder/index for stable coloring
  function getColorForRoom(roomId: string) {
    if (!rooms) return getRoomColor(0);
    const sorted = [...rooms].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((r) => r._id === roomId);
    return getRoomColor(idx >= 0 ? idx : 0);
  }

  // Org members (for name resolution and "book for" dropdown)
  const memberships = useQuery(
    api.organizations.listMembershipsByOrg,
    canManage && orgId ? { orgId } : "skip"
  );
  const memberUserIds = useMemo(
    () => (memberships ?? []).map((m) => m.userId),
    [memberships]
  );

  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Id<"rooms"> | null>(null);
  const [bookingSlot, setBookingSlot] = useState<SlotType>("full_day");
  const [bookingStartTime, setBookingStartTime] = useState("09:00");
  const [bookingEndTime, setBookingEndTime] = useState("10:00");
  const [bookingDescription, setBookingDescription] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookForUserId, setBookForUserId] = useState<Id<"users"> | null>(null); // null = self
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showBookedSlotDialog, setShowBookedSlotDialog] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateStartTime, setUpdateStartTime] = useState("09:00");
  const [updateEndTime, setUpdateEndTime] = useState("10:00");
  const [selectedBookingId, setSelectedBookingId] = useState<Id<"bookings"> | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate query date range based on view mode
  const queryStart = viewMode === "month"
    ? format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }), "yyyy-MM-dd")
    : viewMode === "week"
      ? format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd")
      : format(currentDate, "yyyy-MM-dd");
  const queryEnd = viewMode === "month"
    ? format(endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }), "yyyy-MM-dd")
    : viewMode === "week"
      ? format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd")
      : format(currentDate, "yyyy-MM-dd");

  const rooms = useQuery(api.rooms.listActive, orgId ? { orgId } : "skip");
  const bookings = useQuery(
    api.bookings.listByRoomAndDateRange,
    orgId ? { orgId, startDate: queryStart, endDate: queryEnd } : "skip"
  );
  const blocks = useQuery(
    api.roomBlocks.listByOrg,
    orgId ? { orgId, startDate: queryStart, endDate: queryEnd } : "skip"
  );

  // Auto-pin the selection when there's exactly one room.
  useEffect(() => {
    if (rooms && rooms.length === 1 && selectedRoom !== rooms[0]._id) {
      setSelectedRoom(rooms[0]._id);
    }
  }, [rooms, selectedRoom]);

  // Get Convex user profiles for org members (for name resolution)
  const convexUsers = useQuery(
    api.users.listByIds,
    memberUserIds.length > 0 ? { ids: memberUserIds } : "skip"
  );

  // Helper to resolve a user ID to a display name. Returns empty string when
  // we have no name (so `||` fallbacks to booking.userName etc. work cleanly).
  function resolveUserName(userId: string | null | undefined): string {
    if (!userId) return "";
    const u = convexUsers?.find((x) => x._id === userId);
    return u?.fullName || u?.email || "";
  }

  const createBooking = useMutation(api.bookings.create);
  const cancelBooking = useMutation(api.bookings.cancel);
  const updateBooking = useMutation(api.bookings.update);
  const editBookingDetails = useMutation(api.bookings.editDetails);
  const joinWaitlist = useMutation(api.waitlist.join);

  // Month view days
  const monthStartDate = startOfMonth(currentMonth);
  const monthEndDate = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStartDate, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEndDate, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Week view days (full 7-day week)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Day view - single day
  const dayViewDate = currentDate;

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    if (selectedRoom) return rooms.filter((r) => r._id === selectedRoom);
    return rooms;
  }, [rooms, selectedRoom]);

  const getBookingsForDay = useCallback(
    (dateStr: string) => bookings?.filter((b) => b.date === dateStr) ?? [],
    [bookings]
  );

  const getBlocksForDay = useCallback(
    (dateStr: string) =>
      blocks?.filter((b) => dateStr >= b.startDate && dateStr <= b.endDate) ?? [],
    [blocks]
  );

  const isSlotAvailable = useCallback(
    (dateStr: string, roomId: Id<"rooms">, slot: "full_day" | "am" | "pm"): boolean => {
      const dayBookings = getBookingsForDay(dateStr).filter((b) => b.roomId === roomId);
      const dayBlocks = getBlocksForDay(dateStr).filter((b) => b.roomId === roomId);

      const blocked = dayBlocks.some((b) => {
        if (b.slotType === "full_day") return true;
        if (slot === "full_day") return true;
        return b.slotType === slot;
      });
      if (blocked) return false;

      if (slot === "full_day") return dayBookings.length === 0;
      const hasFullDay = dayBookings.some((b) => b.slotType === "full_day");
      const hasSameSlot = dayBookings.some((b) => b.slotType === slot);
      return !hasFullDay && !hasSameSlot;
    },
    [getBookingsForDay, getBlocksForDay]
  );

  // Get the selected room object for dialog info
  const selectedRoomObj = rooms?.find((r) => r._id === selectedRoom);
  const isHourlyRoom = (selectedRoomObj?.pricingMode ?? "day_based") === "hourly";

  // Calculate session rate for display
  const sessionRate = useMemo(() => {
    if (!selectedRoomObj || !isHourlyRoom) return 0;
    const [sh, sm] = bookingStartTime.split(":").map(Number);
    const [eh, em] = bookingEndTime.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return 0;
    return Math.round((selectedRoomObj.hourlyRate ?? 0) * (mins / 60));
  }, [selectedRoomObj, isHourlyRoom, bookingStartTime, bookingEndTime]);

  const timeOptions = useMemo(() => {
    if (!selectedRoomObj) return generateTimeOptions();
    return generateTimeOptions(
      selectedRoomObj.availabilityStart,
      selectedRoomObj.availabilityEnd
    );
  }, [selectedRoomObj]);

  // Minute-ranges that are already booked for the selected date & room,
  // used to disable conflicting time picks in the Book Room dialog.
  const dialogBusyRanges = useMemo(() => {
    if (!selectedDate || !selectedRoom || !bookings || !selectedRoomObj) return [];
    const rs = parseInt((selectedRoomObj.availabilityStart ?? "08:00").split(":")[0]) * 60;
    const re = parseInt((selectedRoomObj.availabilityEnd ?? "18:00").split(":")[0]) * 60;
    const mid = Math.floor((rs + re) / 2);
    const ranges: { start: number; end: number }[] = [];
    bookings
      .filter(
        (b) =>
          b.date === selectedDate &&
          b.roomId === selectedRoom &&
          b.status === "confirmed"
      )
      .forEach((b) => {
        if (b.slotType === "session" && b.startTime && b.endTime) {
          const [sh, sm] = b.startTime.split(":").map(Number);
          const [eh, em] = b.endTime.split(":").map(Number);
          ranges.push({ start: sh * 60 + sm, end: eh * 60 + em });
        } else if (b.slotType === "full_day") {
          ranges.push({ start: rs, end: re });
        } else if (b.slotType === "am") {
          ranges.push({ start: rs, end: mid });
        } else if (b.slotType === "pm") {
          ranges.push({ start: mid, end: re });
        }
      });
    return ranges;
  }, [selectedDate, selectedRoom, bookings, selectedRoomObj]);

  function timeToMin(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function isStartTimeDisabled(time: string): boolean {
    const min = timeToMin(time);
    // Starting at this time is invalid if it falls inside an existing booking
    return dialogBusyRanges.some((r) => min >= r.start && min < r.end);
  }

  function isEndTimeDisabled(time: string, startTime: string): boolean {
    const end = timeToMin(time);
    const start = timeToMin(startTime);
    if (end <= start) return true;
    // End is invalid if (start, end) overlaps any busy range
    return dialogBusyRanges.some((r) => start < r.end && r.start < end);
  }

  async function handleBookRoom() {
    if (!orgId || !me?._id || !selectedRoom || !selectedDate) return;
    setIsSubmitting(true);
    try {
      const roomObj = rooms?.find((r) => r._id === selectedRoom);
      const isHourly = (roomObj?.pricingMode ?? "day_based") === "hourly";

      // Determine who the booking is for
      const forUserId =
        canManage && bookForUserId && bookForUserId !== me._id
          ? bookForUserId
          : undefined;

      await createBooking({
        orgId,
        roomId: selectedRoom,
        forUserId,
        description: bookingDescription || undefined,
        date: selectedDate,
        slotType: isHourly ? "session" : bookingSlot,
        startTime: isHourly ? bookingStartTime : undefined,
        endTime: isHourly ? bookingEndTime : undefined,
        notes: bookingNotes || undefined,
      });
      toast.success("Room booked successfully!");
      setShowBookingDialog(false);
      setBookingDescription("");
      setBookingNotes("");
      setBookForUserId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to book room");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancelBooking() {
    if (!selectedBookingId || !me?._id) return;
    setShowCancelConfirm(true);
  }

  async function confirmCancelBooking() {
    if (!selectedBookingId || !me?._id) return;
    setIsSubmitting(true);
    try {
      const result = await cancelBooking({
        id: selectedBookingId,
        reason: cancelReason || undefined,
      });
      toast.success(
        result.isBillable
          ? "Booking cancelled (late cancellation - will be billed)"
          : "Booking cancelled successfully"
      );
      if (result.waitlistNotified > 0) {
        toast.info(`${result.waitlistNotified} booker(s) notified from waitlist`);
      }
      setShowCancelConfirm(false);
      setShowDetailDialog(false);
      setCancelReason("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel booking");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleJoinWaitlist(
    roomId: Id<"rooms">,
    date: string,
    slotType: SlotType,
    startTime?: string,
    endTime?: string
  ) {
    if (!orgId || !me?._id) return;
    try {
      await joinWaitlist({ orgId, roomId, date, slotType, startTime, endTime });
      toast.success("You'll be notified if this slot is cancelled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join waitlist");
    }
  }

  function openBookedSlotDialog(bookingId: Id<"bookings">) {
    const booking = bookings?.find((b) => b._id === bookingId);
    if (!booking) return;
    const isMine = booking.userId === me?._id;
    setSelectedBookingId(bookingId);
    if (isMine || canManage) {
      // Own booking or owner / manager / super admin → detail dialog with edit + cancel
      setEditDescription(booking.description ?? "");
      setEditNotes(booking.notes ?? "");
      if (booking.slotType === "session" && booking.startTime && booking.endTime) {
        setUpdateStartTime(booking.startTime);
        setUpdateEndTime(booking.endTime);
      }
      setShowDetailDialog(true);
    } else {
      // Someone else's booking → booked slot info dialog
      setShowBookedSlotDialog(true);
    }
  }

  async function handleUpdateBooking() {
    if (!selectedBookingId) return;
    setIsSubmitting(true);
    try {
      const result = await updateBooking({
        id: selectedBookingId,
        startTime: updateStartTime,
        endTime: updateEndTime,
      });
      toast.success(`Booking updated! New rate: R${(result.rateApplied / 100).toFixed(2)}`);
      if (result.waitlistNotified > 0) {
        toast.info(`${result.waitlistNotified} booker(s) notified from waitlist`);
      }
      setShowUpdateDialog(false);
      setShowDetailDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update booking");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openBookingDialog(date: string, roomId: Id<"rooms">, startTime?: string) {
    const room = rooms?.find((r) => r._id === roomId);
    setSelectedDate(date);
    setSelectedRoom(roomId);
    setBookingNotes("");

    if ((room?.pricingMode ?? "day_based") === "hourly") {
      setBookingSlot("session");
      const st = startTime ?? room?.availabilityStart ?? "09:00";
      setBookingStartTime(st);
      // Auto-set end time based on default session duration
      const duration = room?.sessionDurationMinutes ?? 60;
      const [h, m] = st.split(":").map(Number);
      const endMins = h * 60 + m + duration;
      const eh = Math.floor(endMins / 60);
      const em = endMins % 60;
      setBookingEndTime(`${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
    } else {
      setBookingSlot("full_day");
    }
    setShowBookingDialog(true);
  }

  // ---- Booker coloring (single-room view) & label logic ----
  const bookerColorMap = useMemo(() => {
    if (!bookings) return new Map<string, number>();
    const unique = Array.from(new Set(bookings.map((b) => b.userId))).sort();
    return new Map(unique.map((u, i) => [u, i] as const));
  }, [bookings]);

  function getColorForBooking(booking: NonNullable<typeof bookings>[0]) {
    if (selectedRoom) {
      const idx = bookerColorMap.get(booking.userId) ?? 0;
      return getRoomColor(idx);
    }
    return getColorForRoom(booking.roomId);
  }

  function getBookingLabel(booking: NonNullable<typeof bookings>[0]): {
    main: string;
    sub?: string;
  } {
    const isMine = booking.userId === me?._id;
    if (canManage) {
      return {
        main: resolveUserName(booking.userId) || booking.userName,
        sub: booking.description ?? undefined,
      };
    }
    if (isMine) {
      return { main: booking.description ?? "My Booking" };
    }
    if (showNames) {
      return {
        main: resolveUserName(booking.userId) || booking.userName,
        sub: booking.description ?? undefined,
      };
    }
    return { main: "Blocked" };
  }

  function parseHM(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function bookingRangeMins(
    booking: NonNullable<typeof bookings>[0],
    room: NonNullable<typeof rooms>[0] | undefined
  ): { startMin: number; endMin: number } {
    const roomStart = parseHM(room?.availabilityStart ?? "08:00");
    const roomEnd = parseHM(room?.availabilityEnd ?? "18:00");
    if (booking.slotType === "session" && booking.startTime && booking.endTime) {
      return {
        startMin: parseHM(booking.startTime),
        endMin: parseHM(booking.endTime),
      };
    }
    if (booking.slotType === "full_day") {
      return { startMin: roomStart, endMin: roomEnd };
    }
    const mid = Math.floor((roomStart + roomEnd) / 2);
    if (booking.slotType === "am") return { startMin: roomStart, endMin: mid };
    if (booking.slotType === "pm") return { startMin: mid, endMin: roomEnd };
    return { startMin: roomStart, endMin: roomEnd };
  }

  // Render a day cell for an HOURLY room (All Rooms view)
  function renderHourlyRoomDay(
    room: NonNullable<typeof rooms>[0],
    dateStr: string
  ) {
    if (room.availableDays && room.availableDays.length > 0) {
      const dayOfWeek = new Date(dateStr + "T12:00:00").getDay();
      if (!room.availableDays.includes(dayOfWeek)) {
        return (
          <div
            key={room._id}
            className="text-[10px] px-1 py-0.5 mb-0.5 rounded bg-muted text-muted-foreground truncate opacity-40"
          >
            {room.name}: Closed
          </div>
        );
      }
    }

    const dayBookings = getBookingsForDay(dateStr).filter((b) => b.roomId === room._id);
    const dayBlocks = getBlocksForDay(dateStr).filter((b) => b.roomId === room._id);
    const hasFullDayBlock = dayBlocks.some((b) => b.slotType === "full_day");

    if (hasFullDayBlock) {
      return (
        <div
          key={room._id}
          className={`text-[10px] px-1 py-0.5 mb-0.5 rounded ${tc.blocked} ${tc.blockedText} truncate`}
        >
          {room.name}: Blocked
        </div>
      );
    }

    const startH = parseInt((room.availabilityStart ?? "09:00").split(":")[0]);
    const endH = parseInt((room.availabilityEnd ?? "17:00").split(":")[0]);
    const totalHours = endH - startH;

    const rc = getColorForRoom(room._id);

    if (dayBookings.length === 0 && dayBlocks.length === 0) {
      return (
        <div
          key={room._id}
          className={`text-[10px] px-1 py-0.5 mb-0.5 rounded ${rc.bgLight} ${rc.text} truncate cursor-pointer hover:opacity-80 border-l-2 ${rc.border}`}
          onClick={() => openBookingDialog(dateStr, room._id)}
          title={`${room.name}: Available ${room.availabilityStart}–${room.availabilityEnd}`}
        >
          {room.name}: {room.availabilityStart}–{room.availabilityEnd}
        </div>
      );
    }

    return (
      <div key={room._id} className="mb-0.5">
        <div className={cn("text-[9px] px-0.5 font-medium", rc.text)}>
          {room.name}
        </div>
        <div
          className={`flex h-3 rounded overflow-hidden ${rc.bgLight} cursor-pointer`}
          title={`${room.name}: Click to book`}
          onClick={() => openBookingDialog(dateStr, room._id)}
        >
          {Array.from({ length: totalHours * 2 }, (_, i) => {
            const slotH = startH + Math.floor(i / 2);
            const slotM = (i % 2) * 30;
            const slotStart = `${String(slotH).padStart(2, "0")}:${String(slotM).padStart(2, "0")}`;
            const slotEnd = `${String(slotH + (slotM === 30 ? 1 : 0)).padStart(2, "0")}:${slotM === 30 ? "00" : "30"}`;

            const isBooked = dayBookings.some(
              (b) =>
                b.startTime &&
                b.endTime &&
                timesOverlap(slotStart, slotEnd, b.startTime, b.endTime)
            );
            const isBlocked = dayBlocks.some(
              (b) =>
                b.slotType === "time_range" &&
                b.startTime &&
                b.endTime &&
                timesOverlap(slotStart, slotEnd, b.startTime, b.endTime)
            );

            const booking = isBooked
              ? dayBookings.find(
                  (b) =>
                    b.startTime &&
                    b.endTime &&
                    timesOverlap(slotStart, slotEnd, b.startTime, b.endTime)
                )
              : null;
            const isMine = booking?.userId === me?._id;

            return (
              <div
                key={i}
                className={cn(
                  "flex-1 border-r border-white/50 last:border-0",
                  isBlocked
                    ? "bg-red-500"
                    : isBooked
                      ? isMine
                        ? `${rc.bgMine} ring-1 ring-inset ring-white`
                        : rc.bg
                      : `${rc.bgLight} hover:opacity-80`
                )}
                title={
                  isBlocked
                    ? `Blocked ${slotStart}`
                    : isBooked && booking
                      ? showNames
                        ? `${resolveUserName(booking.userId) || booking.userName} (${booking.startTime}–${booking.endTime})`
                        : `Booked (${booking.startTime}–${booking.endTime})`
                      : `Available ${slotStart}`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (isBooked && booking) {
                    openBookedSlotDialog(booking._id);
                  } else if (!isBlocked) {
                    openBookingDialog(dateStr, room._id, slotStart);
                  }
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  function renderDayBasedRoomDay(
    room: NonNullable<typeof rooms>[0],
    dateStr: string
  ) {
    if (room.availableDays && room.availableDays.length > 0) {
      const dayOfWeek = new Date(dateStr + "T12:00:00").getDay();
      if (!room.availableDays.includes(dayOfWeek)) {
        return (
          <div
            key={room._id}
            className="text-[10px] px-1 py-0.5 mb-0.5 rounded bg-muted text-muted-foreground truncate opacity-40"
          >
            {room.name}: Closed
          </div>
        );
      }
    }

    const dayBookings = getBookingsForDay(dateStr).filter((b) => b.roomId === room._id);
    const dayBlocks = getBlocksForDay(dateStr).filter((b) => b.roomId === room._id);
    const hasFullDayBlock = dayBlocks.some((b) => b.slotType === "full_day");
    const hasFullDayBooking = dayBookings.some((b) => b.slotType === "full_day");

    const rc = getColorForRoom(room._id);

    if (hasFullDayBlock) {
      return (
        <div
          key={room._id}
          className="text-[10px] px-1 py-0.5 mb-0.5 rounded bg-red-500 text-white truncate"
        >
          {room.name}: Blocked
        </div>
      );
    }

    if (hasFullDayBooking) {
      const booking = dayBookings.find((b) => b.slotType === "full_day")!;
      const isMine = booking.userId === me?._id;
      return (
        <div
          key={room._id}
          className={cn(
            "text-[10px] px-1 py-0.5 mb-0.5 rounded truncate cursor-pointer text-white font-medium",
            isMine ? `${rc.bgMine} ring-1 ring-inset ring-white` : rc.bg
          )}
          onClick={() => openBookedSlotDialog(booking._id)}
        >
          {room.name}: {isMine ? "You" : showNames ? (resolveUserName(booking.userId) || booking.userName) : "Booked"}
        </div>
      );
    }

    const available = isSlotAvailable(dateStr, room._id, "full_day");
    if (available) {
      return (
        <div
          key={room._id}
          className={`text-[10px] px-1 py-0.5 mb-0.5 rounded ${rc.bgLight} ${rc.text} truncate cursor-pointer hover:opacity-80 border-l-2 ${rc.border}`}
          onClick={() => openBookingDialog(dateStr, room._id)}
        >
          {room.name}: Available
        </div>
      );
    }

    return (
      <div key={room._id} className="flex gap-0.5 mb-0.5">
        {(["am", "pm"] as const).map((slot) => {
          const slotBooking = dayBookings.find((b) => b.slotType === slot);
          const slotBlocked = dayBlocks.some((b) => b.slotType === slot);

          if (slotBlocked) {
            return (
              <div key={slot} className="text-[9px] px-0.5 rounded bg-red-500 text-white flex-1 text-center">
                {slot.toUpperCase()}
              </div>
            );
          }

          if (slotBooking) {
            const isMine = slotBooking.userId === me?._id;
            return (
              <div
                key={slot}
                className={cn(
                  "text-[9px] px-0.5 rounded flex-1 text-center cursor-pointer text-white font-medium",
                  isMine ? `${rc.bgMine} ring-1 ring-inset ring-white` : rc.bg
                )}
                onClick={() => openBookedSlotDialog(slotBooking._id)}
              >
                {slot.toUpperCase()}
              </div>
            );
          }

          return (
            <div
              key={slot}
              className={`text-[9px] px-0.5 rounded ${rc.bgLight} ${rc.text} flex-1 text-center cursor-pointer hover:opacity-80`}
              onClick={() => {
                setSelectedDate(dateStr);
                setSelectedRoom(room._id);
                setBookingSlot(slot);
                setShowBookingDialog(true);
              }}
            >
              {slot.toUpperCase()}
            </div>
          );
        })}
      </div>
    );
  }

  // Single-room hour-grid cell — used when one room is selected.
  function renderSingleRoomCell(
    room: NonNullable<typeof rooms>[0],
    dateStr: string,
    hourPx: number
  ) {
    const startH = parseInt((room.availabilityStart ?? "08:00").split(":")[0]);
    const endH = parseInt((room.availabilityEnd ?? "18:00").split(":")[0]);
    const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);

    const dayBookings = getBookingsForDay(dateStr).filter((b) => b.roomId === room._id);
    const dayBlocks = getBlocksForDay(dateStr).filter((b) => b.roomId === room._id);

    // Expand an hour's row height when multiple bookings overlap that hour
    // so short (30-min) stacked bookings don't crush into unreadable slivers.
    const hourHeight = hours.map((h) => {
      const hourStart = h * 60;
      const hourEnd = hourStart + 60;
      let count = 0;
      for (const b of dayBookings) {
        const { startMin, endMin } = bookingRangeMins(b, room);
        if (startMin < hourEnd && endMin > hourStart) count++;
      }
      // Doubled when 2+ bookings share an hour, tripled for 3+ etc.
      return count >= 2 ? hourPx * Math.min(count, 3) : hourPx;
    });
    const hourTop: number[] = [];
    {
      let cum = 0;
      for (let i = 0; i < hours.length; i++) {
        hourTop.push(cum);
        cum += hourHeight[i];
      }
      hourTop.push(cum); // sentinel for end of day
    }
    const totalPx = hourTop[hours.length];

    // Map a minute-of-day to its pixel offset in the variable-height grid.
    function minToPx(min: number): number {
      if (min <= startH * 60) return 0;
      if (min >= endH * 60) return totalPx;
      const h = Math.floor(min / 60);
      const idx = h - startH;
      const into = (min - h * 60) / 60;
      return hourTop[idx] + into * hourHeight[idx];
    }

    const dow = new Date(dateStr + "T12:00:00").getDay();
    const closedDay =
      room.availableDays &&
      room.availableDays.length > 0 &&
      !room.availableDays.includes(dow);
    if (closedDay) {
      return (
        <div
          className="text-[10px] text-muted-foreground text-center py-2 bg-muted/30 rounded"
          style={{ height: Math.max(totalPx, 40) }}
        >
          Closed
        </div>
      );
    }

    const fullDayBlocked = dayBlocks.some((b) => b.slotType === "full_day");
    if (fullDayBlocked) {
      return (
        <div
          className="text-[11px] text-white bg-red-500 text-center flex items-center justify-center rounded font-medium"
          style={{ height: totalPx }}
        >
          Blocked
        </div>
      );
    }

    return (
      <div className="relative rounded bg-muted/5 border" style={{ height: totalPx }}>
        {hours.map((h, i) => (
          <div
            key={h}
            className={cn(
              "absolute left-0 right-0 flex items-center hover:bg-muted/20 cursor-pointer",
              i > 0 && "border-t border-dashed border-muted-foreground/30"
            )}
            style={{ top: hourTop[i], height: hourHeight[i] }}
            onClick={() =>
              openBookingDialog(
                dateStr,
                room._id,
                `${String(h).padStart(2, "0")}:00`
              )
            }
            title={`Book ${String(h).padStart(2, "0")}:00`}
          >
            <div className="w-9 shrink-0 text-[9px] text-muted-foreground pl-1 leading-none">
              {String(h).padStart(2, "0")}:00
            </div>
          </div>
        ))}
        {dayBlocks
          .filter((b) => b.slotType !== "full_day")
          .map((b, i) => {
            let startMin = 0,
              endMin = 0;
            if (b.slotType === "time_range" && b.startTime && b.endTime) {
              startMin = parseHM(b.startTime);
              endMin = parseHM(b.endTime);
            } else if (b.slotType === "am" || b.slotType === "pm") {
              const rs = parseHM(room.availabilityStart ?? "08:00");
              const re = parseHM(room.availabilityEnd ?? "18:00");
              const mid = Math.floor((rs + re) / 2);
              if (b.slotType === "am") {
                startMin = rs;
                endMin = mid;
              } else {
                startMin = mid;
                endMin = re;
              }
            }
            const top = minToPx(startMin);
            const height = Math.max(minToPx(endMin) - top, hourPx);
            return (
              <div
                key={`blk-${i}`}
                className="absolute left-0 right-0 bg-red-500/85 text-white flex items-center justify-center text-[10px] font-medium z-10"
                style={{ top, height }}
              >
                Blocked
              </div>
            );
          })}
        {dayBookings.map((b) => {
          const { startMin, endMin } = bookingRangeMins(b, room);
          const top = minToPx(startMin);
          const height = Math.max(minToPx(endMin) - top, hourPx);
          const color = getColorForBooking(b);
          const { main } = getBookingLabel(b);
          const isMine = b.userId === me?._id;
          const timeLabel =
            b.slotType === "session" && b.startTime && b.endTime
              ? `${b.startTime}–${b.endTime}`
              : b.slotType === "full_day"
                ? "Full Day"
                : b.slotType.toUpperCase();
          const rowLabel =
            b.slotType === "session" && b.startTime
              ? b.startTime
              : b.slotType === "full_day"
                ? "Full"
                : b.slotType.toUpperCase();
          return (
            <div
              key={b._id}
              className={cn(
                "absolute left-0 right-0 flex items-center justify-center cursor-pointer text-white overflow-hidden z-20 px-2 opacity-85 hover:opacity-65 transition-opacity",
                isMine ? color.bgMine : color.bg
              )}
              style={{ top, height }}
              onClick={(e) => {
                e.stopPropagation();
                openBookedSlotDialog(b._id);
              }}
              title={`${main} (${timeLabel})`}
            >
              <div className="text-[10px] font-semibold leading-none truncate">
                {rowLabel} - {main}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <UnverifiedDomainsBanner />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Calendar</h1>
          {/* View mode toggle */}
          <div className="flex border rounded-md">
            {(["month", "week", "day"] as const).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                className="rounded-none first:rounded-l-md last:rounded-r-md"
                onClick={() => {
                  setViewMode(mode);
                  if (mode !== "month") setCurrentDate(new Date());
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Navigation — own row on mobile */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (viewMode === "month") setCurrentMonth(subMonths(currentMonth, 1));
              else if (viewMode === "week") setCurrentDate(subWeeks(currentDate, 1));
              else setCurrentDate(subDays(currentDate, 1));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base md:text-lg font-semibold min-w-[160px] md:min-w-[180px] text-center">
            {viewMode === "month"
              ? format(currentMonth, "MMMM yyyy")
              : viewMode === "week"
                ? `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM yyyy")}`
                : format(currentDate, "EEE, d MMM yyyy")}
          </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (viewMode === "month") setCurrentMonth(addMonths(currentMonth, 1));
                else if (viewMode === "week") setCurrentDate(addWeeks(currentDate, 1));
                else setCurrentDate(addDays(currentDate, 1));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentMonth(new Date());
              setCurrentDate(new Date());
            }}
          >
            Today
          </Button>
        </div>
      </div>

      {/* No-rooms nudge */}
      {rooms && rooms.length === 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 flex items-start justify-between gap-3">
          <div className="text-sm">
            <p className="font-medium">No rooms yet</p>
            <p className="text-xs mt-0.5">
              You need at least one room before you can take bookings.
              {isOwner ? " Add one to get started." : " Ask the owner to add a room."}
            </p>
          </div>
          {isOwner && (
            <Link
              href="/rooms/new"
              className={buttonVariants({ size: "sm" })}
            >
              Add a room
            </Link>
          )}
        </div>
      )}

      {/* Room filter tabs */}
      {rooms && rooms.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {rooms.length > 1 && (
            <Button
              variant={selectedRoom === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedRoom(null)}
            >
              All Rooms
            </Button>
          )}
          {rooms.map((room) => {
            const rc = getColorForRoom(room._id);
            const isActive = selectedRoom === room._id;
            return (
              <Button
                key={room._id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  // With a single room, keep it pinned.
                  if (rooms.length === 1) return;
                  setSelectedRoom(isActive ? null : room._id);
                }}
                className={cn(
                  !isActive && rc.bgLight,
                  !isActive && rc.text,
                  !isActive && "hover:opacity-80"
                )}
              >
                <span className={cn("inline-block h-2 w-2 rounded-full mr-1.5", rc.bgMine)} />
                {room.name}
                <span className="ml-1 text-[10px] opacity-60">
                  {(room.pricingMode ?? "day_based") === "hourly" ? "(hourly)" : ""}
                </span>
              </Button>
            );
          })}
          {isOwner && (
            <Link
              href="/rooms/new"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "ml-auto"
              )}
            >
              + Add a room
            </Link>
          )}
        </div>
      )}

      {/* Calendar Grid — tinted to match the selected room */}
      <Card className={cn(selectedRoom && getColorForRoom(selectedRoom).bgLight)}>
        <CardContent className={cn("p-0", selectedRoom && getColorForRoom(selectedRoom).bgLight)}>
          {/* MONTH VIEW */}
          {viewMode === "month" && (() => {
            const singleRoom = selectedRoom ? rooms?.find((r) => r._id === selectedRoom) : null;
            return (
              <>
                <div className={cn("grid grid-cols-7 border-b", singleRoom && getColorForRoom(singleRoom._id).borderSoft)}>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const inMonth = isSameMonth(day, currentMonth);
                    const today = isToday(day);
                    const isPast = isBefore(day, new Date()) && !today;
                    return (
                      <div
                        key={dateStr}
                        className={cn(
                          "border-b border-r p-1",
                          singleRoom ? "min-h-[160px]" : "min-h-[100px]",
                          singleRoom && getColorForRoom(singleRoom._id).borderSoft,
                          !inMonth && "bg-muted/30",
                          isPast && "opacity-50",
                          today && (singleRoom ? getColorForRoom(singleRoom._id).bgTint : "bg-primary/10")
                        )}
                      >
                        <div
                          className={cn(
                            "text-xs font-medium mb-1 px-1",
                            today && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                          )}
                        >
                          {format(day, "d")}
                        </div>
                        {inMonth && !isPast && (
                          singleRoom
                            ? renderSingleRoomCell(singleRoom, dateStr, 13)
                            : filteredRooms.map((room) =>
                                (room.pricingMode ?? "day_based") === "hourly"
                                  ? renderHourlyRoomDay(room, dateStr)
                                  : renderDayBasedRoomDay(room, dateStr)
                              )
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* WEEK VIEW */}
          {viewMode === "week" && (() => {
            const singleRoom = selectedRoom ? rooms?.find((r) => r._id === selectedRoom) : null;
            return (
              <div className="grid grid-cols-7">
                {weekDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const today = isToday(day);
                  const isPast = isBefore(day, new Date()) && !today;
                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "border-b border-r p-2",
                        singleRoom ? "min-h-[220px]" : "min-h-[140px]",
                        singleRoom && getColorForRoom(singleRoom._id).borderSoft,
                        isPast && "opacity-50",
                        today && (singleRoom ? getColorForRoom(singleRoom._id).bgTint : "bg-primary/5")
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={cn(
                            "text-sm font-medium px-2 py-0.5 rounded",
                            today && "bg-primary text-primary-foreground"
                          )}
                        >
                          {format(day, "EEE d MMM")}
                        </div>
                      </div>
                      {!isPast && (
                        singleRoom
                          ? renderSingleRoomCell(singleRoom, dateStr, 18)
                          : filteredRooms.map((room) =>
                              (room.pricingMode ?? "day_based") === "hourly"
                                ? renderHourlyRoomDay(room, dateStr)
                                : renderDayBasedRoomDay(room, dateStr)
                            )
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* DAY VIEW */}
          {viewMode === "day" && (() => {
            const dateStr = format(dayViewDate, "yyyy-MM-dd");
            const today = isToday(dayViewDate);
            const isPast = isBefore(dayViewDate, new Date()) && !today;
            const singleRoom = selectedRoom ? rooms?.find((r) => r._id === selectedRoom) : null;
            return (
              <div className={cn("p-4", isPast && "opacity-50")}>
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className={cn(
                      "text-lg font-semibold px-3 py-1 rounded",
                      today && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(dayViewDate, "EEEE, d MMMM yyyy")}
                  </div>
                </div>
                {singleRoom ? (
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{singleRoom.name}</h3>
                      <span className="text-xs text-muted-foreground">
                        {(singleRoom.pricingMode ?? "day_based") === "hourly"
                          ? `${singleRoom.availabilityStart ?? "00:00"}–${singleRoom.availabilityEnd ?? "24:00"} · R${((singleRoom.hourlyRate ?? 0) / 100).toFixed(2)}/hr`
                          : `Full Day R${((singleRoom.fullDayRate ?? 0) / 100).toFixed(2)} · Half Day R${((singleRoom.halfDayRate ?? 0) / 100).toFixed(2)}`}
                      </span>
                    </div>
                    {!isPast && renderSingleRoomCell(singleRoom, dateStr, 26)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredRooms.map((room) => (
                      <div key={room._id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">{room.name}</h3>
                          <span className="text-xs text-muted-foreground">
                            {(room.pricingMode ?? "day_based") === "hourly"
                              ? `${room.availabilityStart ?? "00:00"}–${room.availabilityEnd ?? "24:00"} · R${((room.hourlyRate ?? 0) / 100).toFixed(2)}/hr`
                              : `Full Day R${((room.fullDayRate ?? 0) / 100).toFixed(2)} · Half Day R${((room.halfDayRate ?? 0) / 100).toFixed(2)}`}
                          </span>
                        </div>
                        {!isPast &&
                          ((room.pricingMode ?? "day_based") === "hourly"
                            ? renderHourlyRoomDay(room, dateStr)
                            : renderDayBasedRoomDay(room, dateStr))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Booking Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Room</DialogTitle>
            <DialogDescription>
              {selectedDate && format(new Date(selectedDate), "EEEE, d MMMM yyyy")}
              {" - "}
              {selectedRoomObj?.name}
              {isHourlyRoom && (
                <span className="ml-1 text-xs">
                  (Available {selectedRoomObj?.availabilityStart}–{selectedRoomObj?.availabilityEnd})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Owner / Manager / Super Admin: Book on behalf of a member */}
            {canManage && memberships && memberships.length > 0 && (
              <div className="space-y-2">
                <Label>Book For</Label>
                <Select
                  value={bookForUserId ?? me?._id ?? ""}
                  onValueChange={(v) => {
                    if (!v) return;
                    setBookForUserId(v === me?._id ? null : (v as Id<"users">));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {resolveUserName(bookForUserId ?? me?._id) || "Member"}
                      {(!bookForUserId || bookForUserId === me?._id) ? " (Myself)" : ""}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {memberships.map((m) => {
                      const isSelf = m.userId === me?._id;
                      return (
                        <SelectItem key={m._id} value={m.userId}>
                          {resolveUserName(m.userId) || "Unknown"}{isSelf ? " (Myself)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Patient / Meeting Name */}
            <div className="space-y-2">
              <Label>Patient / Meeting Name</Label>
              <Input
                value={bookingDescription}
                onChange={(e) => setBookingDescription(e.target.value)}
                placeholder="e.g., John Smith or Team Standup"
              />
            </div>

            {isHourlyRoom ? (
              <>
                {/* Hourly / Session booking */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Select value={bookingStartTime} onValueChange={(v) => {
                      if (!v) return;
                      setBookingStartTime(v);
                      // Auto-set end time based on default duration, but
                      // don't let it overlap the next busy range.
                      const duration = selectedRoomObj?.sessionDurationMinutes ?? 60;
                      const [h, m] = v.split(":").map(Number);
                      const startMin = h * 60 + m;
                      const nextBusy = dialogBusyRanges
                        .filter((r) => r.start > startMin)
                        .reduce(
                          (acc, r) => Math.min(acc, r.start),
                          Number.POSITIVE_INFINITY
                        );
                      const proposedEnd = Math.min(startMin + duration, nextBusy);
                      const eh = Math.floor(proposedEnd / 60);
                      const em = proposedEnd % 60;
                      setBookingEndTime(
                        `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`
                      );
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.slice(0, -1).map((t) => {
                          const disabled = isStartTimeDisabled(t.value);
                          return (
                            <SelectItem
                              key={t.value}
                              value={t.value}
                              disabled={disabled}
                            >
                              {t.label}
                              {disabled ? " (booked)" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Select value={bookingEndTime} onValueChange={(v) => v && setBookingEndTime(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions
                          .filter((t) => t.value > bookingStartTime)
                          .map((t) => {
                            const disabled = isEndTimeDisabled(t.value, bookingStartTime);
                            return (
                              <SelectItem
                                key={t.value}
                                value={t.value}
                                disabled={disabled}
                              >
                                {t.label}
                                {disabled ? " (conflict)" : ""}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Duration</span>
                    <strong>{bookingStartTime < bookingEndTime ? durationLabel(bookingStartTime, bookingEndTime) : "—"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Rate</span>
                    <span>R{((selectedRoomObj?.hourlyRate ?? 0) / 100).toFixed(2)}/hr</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <strong>R{(sessionRate / 100).toFixed(2)}</strong>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Day-based booking */}
                <div className="space-y-2">
                  <Label>Slot</Label>
                  <Select
                    value={bookingSlot}
                    onValueChange={(v) => setBookingSlot(v as SlotType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedDate && selectedRoom && isSlotAvailable(selectedDate, selectedRoom, "full_day") && (
                        <SelectItem value="full_day">Full Day</SelectItem>
                      )}
                      {selectedDate && selectedRoom && isSlotAvailable(selectedDate, selectedRoom, "am") && (
                        <SelectItem value="am">Morning (AM)</SelectItem>
                      )}
                      {selectedDate && selectedRoom && isSlotAvailable(selectedDate, selectedRoom, "pm") && (
                        <SelectItem value="pm">Afternoon (PM)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rate</Label>
                  <p className="text-sm text-muted-foreground">
                    R{(((bookingSlot === "full_day"
                      ? selectedRoomObj?.fullDayRate
                      : selectedRoomObj?.halfDayRate) ?? 0) / 100).toFixed(2)}
                  </p>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Any notes for this booking..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBookingDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBookRoom}
              disabled={isSubmitting || (isHourlyRoom && bookingStartTime >= bookingEndTime)}
            >
              {isSubmitting ? "Booking..." : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Own Booking Detail Dialog (view, update, cancel) */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your Booking</DialogTitle>
          </DialogHeader>
          {selectedBookingId && (() => {
            const booking = bookings?.find((b) => b._id === selectedBookingId);
            if (!booking) return null;
            const room = rooms?.find((r) => r._id === booking.roomId);
            const isSession = booking.slotType === "session" && booking.startTime && booking.endTime;
            return (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {room?.name} — {format(new Date(booking.date), "EEE, d MMM yyyy")}
                  {" — "}
                  {isSession
                    ? `${booking.startTime}–${booking.endTime}`
                    : booking.slotType === "full_day"
                      ? "Full Day"
                      : booking.slotType.toUpperCase()}
                  {" — R"}{(booking.rateApplied / 100).toFixed(2)}
                </div>

                <div className="space-y-2">
                  <Label>Patient / Meeting Name</Label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="e.g., John Smith"
                  />
                </div>

                {isSession && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={updateStartTime}
                        onChange={(e) => setUpdateStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={updateEndTime}
                        onChange={(e) => setUpdateEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Any additional notes..."
                  />
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  <Button
                    onClick={async () => {
                      if (!selectedBookingId) return;
                      setIsSubmitting(true);
                      try {
                        await editBookingDetails({
                          id: selectedBookingId,
                          description: editDescription || undefined,
                          notes: editNotes || undefined,
                          startTime: isSession ? updateStartTime : undefined,
                          endTime: isSession ? updateEndTime : undefined,
                        });
                        toast.success("Booking updated");
                        setShowDetailDialog(false);
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Failed to update");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </Button>
                  <div className="space-y-2 w-full">
                    <Textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Reason for cancellation (optional)"
                    />
                    <Button
                      variant="destructive"
                      onClick={handleCancelBooking}
                      disabled={isSubmitting}
                      className="w-full"
                    >
                      {isSubmitting ? "Cancelling..." : "Cancel Booking"}
                    </Button>
                  </div>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Booked Slot Dialog (someone else's booking) */}
      <Dialog open={showBookedSlotDialog} onOpenChange={setShowBookedSlotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Slot Booked</DialogTitle>
          </DialogHeader>
          {selectedBookingId && (() => {
            const booking = bookings?.find((b) => b._id === selectedBookingId);
            if (!booking) return null;
            const room = rooms?.find((r) => r._id === booking.roomId);
            const slotLabel =
              booking.slotType === "session" && booking.startTime && booking.endTime
                ? `${booking.startTime}–${booking.endTime}`
                : booking.slotType === "full_day"
                  ? "Full Day"
                  : booking.slotType.toUpperCase();
            return (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This slot is already booked
                  {showNames
                    ? ` by ${booking.userName || resolveUserName(booking.userId)}`
                    : ""}.
                </p>
                <div className="space-y-1 text-sm">
                  <p><strong>Room:</strong> {room?.name}</p>
                  <p><strong>Date:</strong> {format(new Date(booking.date), "EEEE, d MMMM yyyy")}</p>
                  <p><strong>Slot:</strong> {slotLabel}</p>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setShowBookedSlotDialog(false)}>
                    Close
                  </Button>
                  <Button
                    onClick={async () => {
                      await handleJoinWaitlist(
                        booking.roomId,
                        booking.date,
                        booking.slotType,
                        booking.startTime ?? undefined,
                        booking.endTime ?? undefined
                      );
                      setShowBookedSlotDialog(false);
                    }}
                  >
                    Notify when cancelled
                  </Button>
                  {isOwner && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setShowBookedSlotDialog(false);
                        setCancelReason("");
                        setShowDetailDialog(true);
                      }}
                    >
                      Cancel Booking
                    </Button>
                  )}
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Update Booking Time Dialog (session bookings only) */}
      <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Booking Time</DialogTitle>
            <DialogDescription>
              Adjust the start or end time for this session.
            </DialogDescription>
          </DialogHeader>
          {selectedBookingId && (() => {
            const booking = bookings?.find((b) => b._id === selectedBookingId);
            if (!booking) return null;
            const room = rooms?.find((r) => r._id === booking.roomId);
            const roomTimeOptions = generateTimeOptions(room?.availabilityStart, room?.availabilityEnd);
            const newDuration = updateStartTime < updateEndTime
              ? durationLabel(updateStartTime, updateEndTime)
              : "—";
            const [ush, usm] = updateStartTime.split(":").map(Number);
            const [ueh, uem] = updateEndTime.split(":").map(Number);
            const newMins = (ueh * 60 + uem) - (ush * 60 + usm);
            const newRate = newMins > 0 ? Math.round((room?.hourlyRate ?? 0) * (newMins / 60)) : 0;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Select value={updateStartTime} onValueChange={(v) => v && setUpdateStartTime(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roomTimeOptions.slice(0, -1).map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Select value={updateEndTime} onValueChange={(v) => v && setUpdateEndTime(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {roomTimeOptions.filter((t) => t.value > updateStartTime).map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>New Duration</span>
                    <strong>{newDuration}</strong>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>New Rate</span>
                    <strong>R{(newRate / 100).toFixed(2)}</strong>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowUpdateDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateBooking}
                    disabled={isSubmitting || updateStartTime >= updateEndTime}
                  >
                    {isSubmitting ? "Updating..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Cancel Booking Confirmation */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure you want to cancel this booking?</DialogTitle>
            <DialogDescription>
              {(() => {
                const booking = bookings?.find((b) => b._id === selectedBookingId);
                if (!booking) return "This action cannot be undone.";
                const room = rooms?.find((r) => r._id === booking.roomId);
                const slotLabel =
                  booking.slotType === "session" && booking.startTime && booking.endTime
                    ? `${booking.startTime}–${booking.endTime}`
                    : booking.slotType === "full_day"
                      ? "Full Day"
                      : booking.slotType.toUpperCase();
                return (
                  <>
                    <span className="block">
                      <strong>{room?.name}</strong> — {format(new Date(booking.date), "EEE, d MMM yyyy")} — {slotLabel}
                    </span>
                    <span className="block mt-2">This action cannot be undone.</span>
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelConfirm(false)}
              disabled={isSubmitting}
            >
              No, keep
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancelBooking}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Cancelling..." : "Yes, cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
