"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";
import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, X, Download, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadBookingIcs } from "@/lib/download-ics";
import { toast } from "sonner";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

export default function BookingsPage() {
  const me = useQuery(api.users.currentUser);
  const { orgId } = useOrgData();
  const { isOwner } = useUserRole();
  const { can } = useSubscriptionTier();
  const hasHistory = can("history");
  const cancelBooking = useMutation(api.bookings.cancel);
  const editBooking = useMutation(api.bookings.editDetails);
  const setExcludeFromInvoice = useMutation(api.bookings.setExcludeFromInvoice);
  const invoicedBookingIds = useQuery(
    api.bookings.getInvoicedBookingIds,
    isOwner && orgId ? { orgId } : "skip"
  );
  const invoicedSet = new Set(invoicedBookingIds ?? []);
  const [excludeConfirm, setExcludeConfirm] = useState<{
    id: Id<"bookings">;
    exclude: boolean;
  } | null>(null);

  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">(
    hasHistory ? "week" : "today"
  );
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Id<"bookings"> | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Id<"bookings"> | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const dateRange =
    period === "today"
      ? { startDate: today, endDate: today }
      : period === "week"
        ? { startDate: weekStart, endDate: weekEnd }
        : period === "month"
          ? { startDate: monthStart, endDate: monthEnd }
          : {};

  const allBookings = useQuery(
    api.bookings.listAllByOrg,
    orgId ? { orgId, ...dateRange } : "skip"
  );

  const rooms = useQuery(api.rooms.list, orgId ? { orgId } : "skip");

  const bookings = isOwner
    ? allBookings
    : allBookings?.filter((b) => b.userId === me?._id);

  async function handleCancel() {
    if (!cancelTarget || !me?._id) return;
    setIsSubmitting(true);
    try {
      const result = await cancelBooking({
        id: cancelTarget,
        reason: cancelReason || undefined,
      });
      toast.success(
        result.isBillable
          ? "Booking cancelled (late cancellation - will be billed)"
          : "Booking cancelled"
      );
      setCancelDialogOpen(false);
      setCancelReason("");
      setCancelTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {isOwner ? "All Bookings" : "My Bookings"}
        </h1>
        <Link href="/calendar" className={buttonVariants()}>
          <CalendarDays className="h-4 w-4 mr-2" />
          Book a Room
        </Link>
      </div>

      <Tabs
        value={period}
        onValueChange={(v) => setPeriod(v as typeof period)}
      >
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="month">This Month</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>

        <TabsContent value={period}>
          <Card>
            <CardHeader>
              <CardTitle>
                {period === "today"
                  ? format(now, "EEEE, d MMMM yyyy")
                  : period === "week"
                    ? `Week of ${format(new Date(weekStart), "d MMM")} - ${format(new Date(weekEnd), "d MMM yyyy")}`
                    : period === "month"
                      ? format(now, "MMMM yyyy")
                      : "All Bookings"}
              </CardTitle>
              <CardDescription>
                {bookings?.length ?? 0} booking(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bookings && bookings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Slot</TableHead>
                      {isOwner && <TableHead>Booker</TableHead>}
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      {isOwner && <TableHead className="text-center">Exclude from Invoice</TableHead>}
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((booking) => {
                        const room = rooms?.find((r) => r._id === booking.roomId);
                        const canCancel =
                          booking.status === "confirmed" &&
                          (isOwner || booking.userId === me?._id);
                        return (
                          <TableRow key={booking._id}>
                            <TableCell>
                              {format(new Date(booking.date), "EEE, d MMM yyyy")}
                            </TableCell>
                            <TableCell>{room?.name ?? "—"}</TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {booking.description ?? "—"}
                            </TableCell>
                            <TableCell>
                              {booking.slotType === "session" &&
                              booking.startTime &&
                              booking.endTime
                                ? `${booking.startTime}–${booking.endTime}`
                                : booking.slotType === "full_day"
                                  ? "Full Day"
                                  : booking.slotType.toUpperCase()}
                            </TableCell>
                            {isOwner && (
                              <TableCell>
                                <div>{booking.userName}</div>
                                {booking.bookedBy && (
                                  <div className="text-xs text-muted-foreground">
                                    Booked by: {booking.bookedByName ?? "Owner"}
                                  </div>
                                )}
                              </TableCell>
                            )}
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
                              {booking.status === "cancelled" &&
                                booking.isBillable && (
                                  <Badge variant="outline" className="ml-1 text-xs">
                                    Billable
                                  </Badge>
                                )}
                            </TableCell>
                            {isOwner && (
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={booking.excludeFromInvoice ?? false}
                                  onCheckedChange={(v) => {
                                    const nextExclude = v === true;
                                    if (nextExclude && invoicedSet.has(booking._id)) {
                                      setExcludeConfirm({ id: booking._id, exclude: nextExclude });
                                    } else {
                                      setExcludeFromInvoice({
                                        id: booking._id,
                                        exclude: nextExclude,
                                      }).then(() =>
                                        toast.success(
                                          nextExclude
                                            ? "Excluded from future invoices"
                                            : "Included in future invoices"
                                        )
                                      );
                                    }
                                  }}
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {booking.status === "confirmed" && (isOwner || booking.userId === me?._id) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditTarget(booking._id);
                                      setEditDescription(booking.description ?? "");
                                      setEditNotes(booking.notes ?? "");
                                      setEditStartTime(booking.startTime ?? "");
                                      setEditEndTime(booking.endTime ?? "");
                                      setEditDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                {booking.status === "confirmed" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      downloadBookingIcs({
                                        id: booking._id,
                                        date: booking.date,
                                        slotType: booking.slotType,
                                        startTime: booking.startTime ?? undefined,
                                        endTime: booking.endTime ?? undefined,
                                        description: booking.description ?? undefined,
                                        notes: booking.notes ?? undefined,
                                        roomName: room?.name,
                                      });
                                    }}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                )}
                                {canCancel && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setCancelTarget(booking._id);
                                      setCancelReason("");
                                      setCancelDialogOpen(true);
                                    }}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No bookings found for this period.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to cancel this booking?
            </p>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (optional)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exclude-from-invoice warning when booking is already on an invoice */}
      <Dialog open={excludeConfirm !== null} onOpenChange={(open) => !open && setExcludeConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Heads up — this booking is already invoiced</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This booking has already been included on an existing invoice. Excluding
            it will only take effect when a <strong>new</strong> invoice is generated —
            the existing invoice is unchanged.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcludeConfirm(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!excludeConfirm) return;
                try {
                  await setExcludeFromInvoice({
                    id: excludeConfirm.id,
                    exclude: excludeConfirm.exclude,
                  });
                  toast.success("Excluded from future invoices");
                  setExcludeConfirm(null);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              OK, exclude from future invoices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Booking Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          {editTarget && (() => {
            const booking = allBookings?.find((b) => b._id === editTarget);
            if (!booking) return null;
            const room = rooms?.find((r) => r._id === booking.roomId);
            const isSession = booking.slotType === "session";

            return (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {room?.name} — {format(new Date(booking.date), "EEE, d MMM yyyy")}
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
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
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
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={async () => {
                if (!editTarget) return;
                setIsSubmitting(true);
                try {
                  await editBooking({
                    id: editTarget,
                    description: editDescription || undefined,
                    notes: editNotes || undefined,
                    startTime: editStartTime || undefined,
                    endTime: editEndTime || undefined,
                  });
                  toast.success("Booking updated");
                  setEditDialogOpen(false);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Failed to update"
                  );
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
