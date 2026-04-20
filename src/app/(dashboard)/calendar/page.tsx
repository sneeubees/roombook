"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import { useUser, useOrganization } from "@clerk/nextjs";
import { useState, useCallback, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
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
  const { user } = useUser();
  const { orgId, convexOrg } = useOrgData();
  const { isOwner } = useUserRole();
  const showNames = isOwner || (convexOrg?.showBookerNames ?? false);
  const tc = getThemeColors(convexOrg?.calendarTheme);

  // Get room color by room ID — uses sortOrder/index for stable coloring
  function getColorForRoom(roomId: string) {
    if (!rooms) return getRoomColor(0);
    const sorted = [...rooms].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((r) => r._id === roomId);
    return getRoomColor(idx >= 0 ? idx : 0);
  }
  const { memberships } = useOrganization({
    memberships: isOwner ? { pageSize: 100 } : undefined,
  });

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
  const [bookForUserId, setBookForUserId] = useState<string | null>(null); // null = self
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showBookedSlotDialog, setShowBookedSlotDialog] = useState(false);
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

  // Get Convex user profiles for org members (for name resolution)
  const memberUserIds = useMemo(
    () => memberships?.data?.map((m) => m.publicUserData?.userId).filter(Boolean) as string[] ?? [],
    [memberships?.data]
  );
  const convexUsers = useQuery(
    api.users.listByClerkUserIds,
    memberUserIds.length > 0 ? { clerkUserIds: memberUserIds } : "skip"
  );

  // Helper to resolve a Clerk user ID to a display name
  function resolveUserName(clerkUserId: string): string {
    const convexUser = convexUsers?.find((u) => u.clerkUserId === clerkUserId);
    if (convexUser?.fullName) return convexUser.fullName;
    const member = memberships?.data?.find((m) => m.publicUserData?.userId === clerkUserId);
    return member?.publicUserData?.identifier ?? clerkUserId;
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

  async function handleBookRoom() {
    if (!orgId || !user?.id || !selectedRoom || !selectedDate) return;
    setIsSubmitting(true);
    try {
      const roomObj = rooms?.find((r) => r._id === selectedRoom);
      const isHourly = (roomObj?.pricingMode ?? "day_based") === "hourly";

      // Determine who the booking is for
      let targetUserId = user.id;
      let targetUserName = user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "Unknown";
      let bookedBy: string | undefined;
      let bookedByName: string | undefined;

      if (isOwner && bookForUserId && bookForUserId !== user.id) {
        // Owner booking on behalf of a booker
        const member = memberships?.data?.find(
          (m) => m.publicUserData?.userId === bookForUserId
        );
        targetUserId = bookForUserId;
        targetUserName = resolveUserName(bookForUserId);
        bookedBy = user.id;
        bookedByName = user.fullName ?? "Owner";
      }

      await createBooking({
        orgId,
        roomId: selectedRoom,
        userId: targetUserId,
        userName: targetUserName,
        description: bookingDescription || undefined,
        bookedBy,
        bookedByName,
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

  async function handleCancelBooking() {
    if (!selectedBookingId || !user?.id) return;
    setIsSubmitting(true);
    try {
      const result = await cancelBooking({
        id: selectedBookingId,
        cancelledBy: user.id,
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
    if (!orgId || !user?.id) return;
    try {
      await joinWaitlist({ orgId, roomId, userId: user.id, date, slotType, startTime, endTime });
      toast.success("Added to waitlist! You'll be notified if it opens up.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join waitlist");
    }
  }

  function openBookedSlotDialog(bookingId: Id<"bookings">) {
    const booking = bookings?.find((b) => b._id === bookingId);
    if (!booking) return;
    const isMine = booking.userId === user?.id;
    setSelectedBookingId(bookingId);
    if (isMine || isOwner) {
      // Own booking or owner → detail dialog with edit + cancel
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
    const isMine = booking.userId === user?.id;
    if (isOwner) {
      return {
        main: resolveUserName(booking.userId),
        sub: booking.description ?? undefined,
      };
    }
    if (isMine) {
      return { main: booking.description ?? "My Booking" };
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

  const dayRangeHours = useMemo(() => {
    let min = 8;
    let max = 18;
    (rooms ?? []).forEach((r) => {
      if (r.availabilityStart) {
        min = Math.min(min, parseInt(r.availabilityStart.split(":")[0]));
      }
      if (r.availabilityEnd) {
        const eh = parseInt(r.availabilityEnd.split(":")[0]);
        max = Math.max(max, eh);
      }
    });
    return { startH: Math.max(min, 0), endH: Math.min(Math.max(max, min + 1), 24) };
  }, [rooms]);

  function getSortedDayBookings(dateStr: string) {
    return getBookingsForDay(dateStr)
      .filter((b) => (selectedRoom ? b.roomId === selectedRoom : true))
      .sort((a, b) => {
        const ra = rooms?.find((r) => r._id === a.roomId);
        const rb = rooms?.find((r) => r._id === b.roomId);
        return bookingRangeMins(a, ra).startMin - bookingRangeMins(b, rb).startMin;
      });
  }

  // ---- BookingPill (compact block used in month/week cells) ----
  function BookingPill({
    booking,
    size,
  }: {
    booking: NonNullable<typeof bookings>[0];
    size: "xs" | "sm";
  }) {
    const color = getColorForBooking(booking);
    const { main, sub } = getBookingLabel(booking);
    const isMine = booking.userId === user?.id;
    const room = rooms?.find((r) => r._id === booking.roomId);
    const timeLabel =
      booking.slotType === "session" && booking.startTime && booking.endTime
        ? `${booking.startTime}–${booking.endTime}`
        : booking.slotType === "full_day"
          ? "Full Day"
          : booking.slotType.toUpperCase();
    const shortTime =
      booking.slotType === "session" && booking.startTime
        ? booking.startTime
        : booking.slotType === "full_day"
          ? "Day"
          : booking.slotType.toUpperCase();
    return (
      <div
        className={cn(
          "rounded text-white cursor-pointer hover:opacity-90 font-medium text-center leading-tight overflow-hidden",
          isMine ? color.bgMine : color.bg,
          size === "xs" && "text-[10px] px-1 py-0.5",
          size === "sm" && "text-[11px] px-1.5 py-1"
        )}
        onClick={(e) => {
          e.stopPropagation();
          openBookedSlotDialog(booking._id);
        }}
        title={`${main}${sub ? " — " + sub : ""} · ${room?.name ?? ""} · ${timeLabel}`}
      >
        {size === "xs" ? (
          <div className="truncate">
            <span className="opacity-80 mr-1">{shortTime}</span>
            {main}
          </div>
        ) : (
          <>
            <div className="truncate">{main}</div>
            <div className="text-[9px] opacity-85 truncate">
              {timeLabel}
              {!selectedRoom && room?.name ? ` · ${room.name}` : ""}
            </div>
            {sub && (
              <div className="text-[9px] opacity-70 truncate">{sub}</div>
            )}
          </>
        )}
      </div>
    );
  }

  // ---- Full timeline (day view) ----
  function renderTimeline(dateStr: string, hourPx: number) {
    const { startH, endH } = dayRangeHours;
    const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
    const totalPx = (endH - startH) * hourPx;
    const visibleRooms = filteredRooms;
    const dayBookings = getBookingsForDay(dateStr);
    const dayBlocks = getBlocksForDay(dateStr);

    return (
      <div className="flex overflow-x-auto">
        <div className="w-12 shrink-0 pt-7">
          {hours.map((h) => (
            <div
              key={h}
              className="text-right pr-2 text-[10px] text-muted-foreground -mt-1.5"
              style={{ height: hourPx }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="flex-1 flex min-w-0">
          {visibleRooms.map((room) => {
            const roomBookings = dayBookings.filter((b) => b.roomId === room._id);
            const roomBlocks = dayBlocks.filter((b) => b.roomId === room._id);
            const dow = new Date(dateStr + "T12:00:00").getDay();
            const closedDay =
              room.availableDays &&
              room.availableDays.length > 0 &&
              !room.availableDays.includes(dow);
            const fullDayBlocked = roomBlocks.some((b) => b.slotType === "full_day");
            const rc = getColorForRoom(room._id);
            return (
              <div
                key={room._id}
                className="flex-1 min-w-[120px] border-l last:border-r relative"
              >
                <div
                  className={cn(
                    "px-1 py-1 text-[11px] font-medium truncate text-center border-b sticky top-0 z-30",
                    rc.bgLight,
                    rc.text
                  )}
                >
                  {room.name}
                </div>
                <div
                  className={cn("relative", closedDay && "bg-muted/40")}
                  style={{ height: totalPx }}
                >
                  {closedDay ? (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-[10px]">
                      Closed
                    </div>
                  ) : fullDayBlocked ? (
                    <div className="absolute inset-0 bg-red-500 text-white flex items-center justify-center text-[11px] font-medium">
                      Blocked
                    </div>
                  ) : (
                    <>
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/20"
                          style={{ top: (h - startH) * hourPx }}
                        />
                      ))}
                      <div
                        className="absolute inset-0 cursor-pointer hover:bg-muted/20"
                        onClick={() => openBookingDialog(dateStr, room._id)}
                        title={`Book ${room.name}`}
                      />
                      {roomBlocks
                        .filter((b) => b.slotType !== "full_day")
                        .map((b, i) => {
                          let startMin = 0;
                          let endMin = 0;
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
                          const top = ((startMin - startH * 60) / 60) * hourPx;
                          const h = Math.max(((endMin - startMin) / 60) * hourPx, 20);
                          return (
                            <div
                              key={`blk-${i}`}
                              className="absolute left-0.5 right-0.5 bg-red-500/85 text-white rounded flex items-center justify-center text-[10px] font-medium z-10"
                              style={{ top, height: h }}
                            >
                              Blocked
                            </div>
                          );
                        })}
                      {roomBookings.map((b) => {
                        const { startMin, endMin } = bookingRangeMins(b, room);
                        const top = ((startMin - startH * 60) / 60) * hourPx;
                        const height = Math.max(
                          ((endMin - startMin) / 60) * hourPx,
                          22
                        );
                        const color = getColorForBooking(b);
                        const { main, sub } = getBookingLabel(b);
                        const isMine = b.userId === user?.id;
                        const timeLabel =
                          b.slotType === "session" && b.startTime && b.endTime
                            ? `${b.startTime}–${b.endTime}`
                            : b.slotType === "full_day"
                              ? "Full Day"
                              : b.slotType.toUpperCase();
                        return (
                          <div
                            key={b._id}
                            className={cn(
                              "absolute left-0.5 right-0.5 rounded px-1 flex flex-col items-center justify-center text-center cursor-pointer hover:opacity-90 text-white overflow-hidden z-20 ring-1 ring-inset ring-white/40",
                              isMine ? color.bgMine : color.bg
                            )}
                            style={{ top, height }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openBookedSlotDialog(b._id);
                            }}
                            title={`${main}${sub ? " — " + sub : ""} (${timeLabel})`}
                          >
                            <div className="text-[11px] font-semibold leading-tight truncate w-full">
                              {main}
                            </div>
                            {sub && height > 44 && (
                              <div className="text-[9px] opacity-85 truncate w-full leading-tight">
                                {sub}
                              </div>
                            )}
                            {height > 28 && (
                              <div className="text-[9px] opacity-75 leading-tight">
                                {timeLabel}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Room filter tabs */}
      {rooms && rooms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedRoom === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedRoom(null)}
          >
            All Rooms
          </Button>
          {rooms.map((room) => {
            const rc = getColorForRoom(room._id);
            return (
              <Button
                key={room._id}
                variant={selectedRoom === room._id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRoom(selectedRoom === room._id ? null : room._id)}
              >
                <span className={cn("inline-block h-2 w-2 rounded-full mr-1.5", rc.bgMine)} />
                {room.name}
                <span className="ml-1 text-[10px] opacity-60">
                  {(room.pricingMode ?? "day_based") === "hourly" ? "(hourly)" : ""}
                </span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {/* MONTH VIEW — stacked chronological booking pills per day */}
          {viewMode === "month" && (
            <>
              <div className="grid grid-cols-7 border-b">
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
                  const cellBookings = inMonth && !isPast ? getSortedDayBookings(dateStr) : [];
                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "min-h-[110px] border-b border-r p-1 space-y-0.5",
                        !inMonth && "bg-muted/30",
                        isPast && "opacity-50",
                        inMonth && !isPast && "cursor-pointer hover:bg-muted/20"
                      )}
                      onClick={() => {
                        if (inMonth && !isPast && filteredRooms.length === 1) {
                          openBookingDialog(dateStr, filteredRooms[0]._id);
                        }
                      }}
                    >
                      <div
                        className={cn(
                          "text-xs font-medium mb-1 px-1",
                          today && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                      {cellBookings.slice(0, 5).map((b) => (
                        <BookingPill key={b._id} booking={b} size="xs" />
                      ))}
                      {cellBookings.length > 5 && (
                        <div className="text-[9px] text-muted-foreground text-center">
                          +{cellBookings.length - 5} more
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* WEEK VIEW — 7 day columns, bookings stacked chronologically */}
          {viewMode === "week" && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
              {weekDays.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const today = isToday(day);
                const isPast = isBefore(day, new Date()) && !today;
                const cellBookings = !isPast ? getSortedDayBookings(dateStr) : [];
                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "min-h-[220px] border-b border-r p-2 space-y-1",
                      isPast && "opacity-50",
                      today && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={cn(
                          "text-sm font-medium px-2 py-0.5 rounded",
                          today && "bg-primary text-primary-foreground"
                        )}
                      >
                        {format(day, "EEE d MMM")}
                      </div>
                      {!isPast && filteredRooms.length === 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1 text-[10px]"
                          onClick={() => openBookingDialog(dateStr, filteredRooms[0]._id)}
                        >
                          + Book
                        </Button>
                      )}
                    </div>
                    {cellBookings.length > 0 ? (
                      cellBookings.map((b) => (
                        <BookingPill key={b._id} booking={b} size="sm" />
                      ))
                    ) : !isPast ? (
                      <div className="text-[10px] text-muted-foreground text-center pt-2">
                        No bookings
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* DAY VIEW — full-width timeline, rooms as columns */}
          {viewMode === "day" && (() => {
            const dateStr = format(dayViewDate, "yyyy-MM-dd");
            const today = isToday(dayViewDate);
            const isPast = isBefore(dayViewDate, new Date()) && !today;
            return (
              <div className={cn("p-4 space-y-4", isPast && "opacity-60")}>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "text-lg font-semibold px-3 py-1 rounded",
                      today && "bg-primary text-primary-foreground"
                    )}
                  >
                    {format(dayViewDate, "EEEE, d MMMM yyyy")}
                  </div>
                </div>
                {filteredRooms.length > 0 ? (
                  renderTimeline(dateStr, 48)
                ) : (
                  <p className="text-sm text-muted-foreground">No rooms available.</p>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-200 border border-gray-300" />
          <span>Available (in room colour)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-500 ring-1 ring-white" />
          <span>Your Booking</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-400" />
          <span>Other&apos;s Booking</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span>Blocked</span>
        </div>
      </div>

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
            {/* Owner: Book on behalf of a member */}
            {isOwner && memberships?.data && memberships.data.length > 0 && (
              <div className="space-y-2">
                <Label>Book For</Label>
                <Select
                  value={bookForUserId ?? user?.id ?? ""}
                  onValueChange={(v) => v && setBookForUserId(v === user?.id ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {resolveUserName(bookForUserId ?? user?.id ?? "")}
                      {(!bookForUserId || bookForUserId === user?.id) ? " (Myself)" : ""}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {memberships.data.map((m) => {
                      const uid = m.publicUserData?.userId ?? "";
                      const isSelf = uid === user?.id;
                      return (
                        <SelectItem key={uid || m.id} value={uid}>
                          {resolveUserName(uid)}{isSelf ? " (Myself)" : ""}
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
                      // Auto-set end time based on default duration
                      const duration = selectedRoomObj?.sessionDurationMinutes ?? 60;
                      const [h, m] = v.split(":").map(Number);
                      const endMins = h * 60 + m + duration;
                      const eh = Math.floor(endMins / 60);
                      const em = endMins % 60;
                      setBookingEndTime(`${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.slice(0, -1).map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
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
                          .map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
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
                          actorId: user?.id,
                          actorName: user?.fullName ?? undefined,
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
                  {showNames ? ` by ${resolveUserName(booking.userId)}` : ""}.
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
                    Join Waitlist
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
    </div>
  );
}
