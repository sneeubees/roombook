"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import { useUser, useOrganization } from "@clerk/nextjs";
import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function BookingHistoryPage() {
  const { user } = useUser();
  const { orgId } = useOrgData();
  const { isOwner } = useUserRole();
  const { memberships } = useOrganization({
    memberships: isOwner ? { pageSize: 100 } : undefined,
  });

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Get all org members' Convex profiles for name resolution
  const memberUserIds = useMemo(
    () =>
      (memberships?.data
        ?.map((m) => m.publicUserData?.userId)
        .filter(Boolean) as string[]) ?? [],
    [memberships?.data]
  );
  const convexUsers = useQuery(
    api.users.listByClerkUserIds,
    memberUserIds.length > 0 ? { clerkUserIds: memberUserIds } : "skip"
  );

  function resolveUserName(clerkUserId: string): string {
    const cu = convexUsers?.find((u) => u.clerkUserId === clerkUserId);
    return cu?.fullName || clerkUserId;
  }

  // Determine which user's bookings to show
  const targetUserId = isOwner ? (selectedUserId ?? user?.id) : user?.id;

  // Get all bookings for the target user
  const allBookings = useQuery(
    api.bookings.listAllByOrg,
    orgId ? { orgId } : "skip"
  );

  const rooms = useQuery(api.rooms.list, orgId ? { orgId } : "skip");

  // Filter bookings for selected user
  const userBookings = useMemo(() => {
    if (!allBookings || !targetUserId) return [];
    return allBookings
      .filter((b) => b.userId === targetUserId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allBookings, targetUserId]);

  // Group by month
  const groupedByMonth = useMemo(() => {
    const groups = new Map<string, typeof userBookings>();
    for (const booking of userBookings) {
      const monthKey = booking.date.substring(0, 7); // "2026-04"
      const existing = groups.get(monthKey) ?? [];
      existing.push(booking);
      groups.set(monthKey, existing);
    }
    return Array.from(groups.entries()).sort((a, b) =>
      b[0].localeCompare(a[0])
    );
  }, [userBookings]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Booking History</h1>
      </div>

      {/* Owner: user selector */}
      {isOwner && memberships?.data && (
        <div className="max-w-xs">
          <Select
            value={selectedUserId ?? user?.id ?? ""}
            onValueChange={(v) => v && setSelectedUserId(v)}
          >
            <SelectTrigger>
              <SelectValue>
                {resolveUserName(selectedUserId ?? user?.id ?? "")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {memberships.data.map((m) => {
                const uid = m.publicUserData?.userId ?? "";
                return (
                  <SelectItem key={uid || m.id} value={uid}>
                    {resolveUserName(uid)}
                    {uid === user?.id ? " (You)" : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Booking history grouped by month */}
      {groupedByMonth.length > 0 ? (
        groupedByMonth.map(([monthKey, bookings]) => {
          const monthDate = parseISO(monthKey + "-01");
          const totalRate = bookings.reduce(
            (sum, b) => sum + (b.status === "confirmed" || b.isBillable ? b.rateApplied : 0),
            0
          );

          return (
            <Card key={monthKey}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {format(monthDate, "MMMM yyyy")}
                  </CardTitle>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {bookings.length} booking(s)
                    </span>
                    <Badge variant="outline">
                      R{(totalRate / 100).toFixed(2)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => {
                      const room = rooms?.find(
                        (r) => r._id === booking.roomId
                      );
                      return (
                        <TableRow key={booking._id}>
                          <TableCell>
                            {format(
                              new Date(booking.date),
                              "EEE, d MMM"
                            )}
                          </TableCell>
                          <TableCell>{room?.name ?? "—"}</TableCell>
                          <TableCell>
                            {booking.slotType === "session" &&
                            booking.startTime &&
                            booking.endTime
                              ? `${booking.startTime}–${booking.endTime}`
                              : booking.slotType === "full_day"
                                ? "Full Day"
                                : booking.slotType.toUpperCase()}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {booking.description ?? "—"}
                          </TableCell>
                          <TableCell>
                            R{(booking.rateApplied / 100).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                booking.status === "confirmed"
                                  ? "default"
                                  : "destructive"
                              }
                            >
                              {booking.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <CardTitle className="text-lg">No booking history</CardTitle>
            <CardDescription>
              {isOwner
                ? "Select a user above to view their booking history."
                : "You don't have any past bookings yet."}
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
