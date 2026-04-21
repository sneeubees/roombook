"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarDays, DoorOpen, FileText, Users } from "lucide-react";
import { UnverifiedDomainsBanner } from "@/components/unverified-domains-banner";
import { useMemo } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";

export default function DashboardPage() {
  const me = useQuery(api.users.currentUser);
  const { orgId } = useOrgData();
  const { isOwner } = useUserRole();

  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const rooms = useQuery(
    api.rooms.listActive,
    orgId ? { orgId } : "skip"
  );

  const todayBookings = useQuery(
    api.bookings.listByRoomAndDateRange,
    orgId ? { orgId, startDate: today, endDate: today } : "skip"
  );

  const weekBookings = useQuery(
    api.bookings.listByRoomAndDateRange,
    orgId ? { orgId, startDate: weekStart, endDate: weekEnd } : "skip"
  );

  const myBookings = useQuery(
    api.bookings.listByUser,
    orgId && me?._id
      ? { orgId, userId: me._id, startDate: weekStart, endDate: weekEnd }
      : "skip"
  );

  // Resolve user names from Convex
  const bookerIds = useMemo(() => {
    const ids = new Set<string>();
    todayBookings?.forEach((b) => ids.add(b.userId));
    return Array.from(ids);
  }, [todayBookings]);

  const convexUsers = useQuery(
    api.users.listByIds,
    bookerIds.length > 0 ? { ids: bookerIds as any } : "skip"
  );

  function resolveUserName(userId: string): string {
    const cu = convexUsers?.find((u) => u._id === userId);
    return cu?.fullName || userId;
  }

  return (
    <div className="space-y-6">
      <UnverifiedDomainsBanner />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {me?.fullName?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
        </div>
        <Link href="/calendar" className={buttonVariants()}>
          <CalendarDays className="h-4 w-4 mr-2" />
          Book a Room
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {isOwner ? "Total Rooms" : "My Bookings This Week"}
            </CardTitle>
            {isOwner ? (
              <DoorOpen className="h-4 w-4 text-muted-foreground" />
            ) : (
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isOwner ? (rooms?.length ?? 0) : (myBookings?.length ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Booked Today
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayBookings?.length ?? 0}
            </div>
            <CardDescription>
              of {rooms?.length ?? 0} rooms
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              This Week
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {weekBookings?.length ?? 0}
            </div>
            <CardDescription>bookings</CardDescription>
          </CardContent>
        </Card>

        {isOwner && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Active Rooms
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {rooms?.filter((r) => r.isActive).length ?? 0}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Today's bookings overview */}
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Schedule</CardTitle>
          <CardDescription>
            {isOwner
              ? "All room bookings for today"
              : "Your bookings for today"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {todayBookings && todayBookings.length > 0 ? (
            <div className="space-y-3">
              {todayBookings
                .filter((b) => (isOwner ? true : b.userId === me?._id))
                .map((booking) => {
                  const room = rooms?.find((r) => r._id === booking.roomId);
                  return (
                    <div
                      key={booking._id}
                      className="flex items-center justify-between rounded-md border p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {room?.name ?? "Unknown Room"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {booking.slotType === "session" && booking.startTime && booking.endTime
                            ? `${booking.startTime} – ${booking.endTime}`
                            : booking.slotType === "full_day"
                              ? "Full Day"
                              : booking.slotType === "am"
                                ? "Morning (AM)"
                                : "Afternoon (PM)"}
                        </p>
                      </div>
                      {isOwner && (
                        <p className="text-sm text-muted-foreground">
                          {resolveUserName(booking.userId)}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No bookings for today.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
