"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import Link from "next/link";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Id } from "../../../../convex/_generated/dataModel";

export default function RoomsPage() {
  const { orgId } = useOrgData();
  const { isOwner } = useUserRole();
  const rooms = useQuery(api.rooms.list, orgId ? { orgId } : "skip");
  const updateRoom = useMutation(api.rooms.update);
  const removeRoom = useMutation(api.rooms.remove);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"rooms">;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Rooms</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rooms
            ?.filter((r) => r.isActive)
            .map((room) => (
              <Card key={room._id}>
                <CardHeader>
                  <CardTitle>{room.name}</CardTitle>
                  {room.description && (
                    <CardDescription>{room.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {(room.pricingMode ?? "day_based") === "day_based" ? (
                      <>
                        <p>Full Day: <strong>R{((room.fullDayRate ?? 0) / 100).toFixed(2)}</strong></p>
                        <p>Half Day: <strong>R{((room.halfDayRate ?? 0) / 100).toFixed(2)}</strong></p>
                      </>
                    ) : (
                      <>
                        <p>Hourly: <strong>R{((room.hourlyRate ?? 0) / 100).toFixed(2)}/hr</strong></p>
                        <p>Available: <strong>{room.availabilityStart}–{room.availabilityEnd}</strong></p>
                      </>
                    )}
                    {room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {room.amenities.map((a) => (
                          <Badge key={a} variant="secondary" className="text-xs">
                            {a}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rooms</h1>
        <Link href="/rooms/new" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Room
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        To remove a room, please deactivate it first — an active room cannot be
        deleted. Deleted rooms are kept in historical records so past bookings
        and invoices remain intact; you can create a new room with the same
        name afterwards.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms?.map((room) => (
          <Card key={room._id} className={!room.isActive ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{room.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={room.isActive}
                    onCheckedChange={async (checked) => {
                      await updateRoom({ id: room._id, isActive: checked });
                      toast.success(
                        checked ? "Room activated" : "Room deactivated"
                      );
                    }}
                  />
                  <Link
                    href={`/rooms/${room._id}/edit`}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "icon",
                    })}
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  {!room.isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() =>
                        setDeleteTarget({ id: room._id, name: room.name })
                      }
                      title="Delete room"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              {room.description && (
                <CardDescription>{room.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Pricing</span>
                  <Badge variant="outline" className="text-xs">
                    {(room.pricingMode ?? "day_based") === "day_based" ? "Day-Based" : "Hourly"}
                  </Badge>
                </div>
                {(room.pricingMode ?? "day_based") === "day_based" ? (
                  <>
                    <div className="flex justify-between">
                      <span>Full Day Rate</span>
                      <strong>R{((room.fullDayRate ?? 0) / 100).toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Half Day Rate</span>
                      <strong>R{((room.halfDayRate ?? 0) / 100).toFixed(2)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>Hourly Rate</span>
                      <strong>R{((room.hourlyRate ?? 0) / 100).toFixed(2)}/hr</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Availability</span>
                      <strong>{room.availabilityStart}–{room.availabilityEnd}</strong>
                    </div>
                    {room.sessionDurationMinutes && (
                      <div className="flex justify-between">
                        <span>Default Session</span>
                        <strong>{room.sessionDurationMinutes} min</strong>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between">
                  <span>Cancellation</span>
                  <Badge variant="outline" className="text-xs">
                    {room.cancellationPolicy === "always_free"
                      ? "Free cancellation"
                      : `Late fee (under ${room.cancellationDeadlineHours}h notice)`}
                  </Badge>
                </div>
                {room.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {room.amenities.map((a) => (
                      <Badge key={a} variant="secondary" className="text-xs">
                        {a}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete room?</DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong> will be hidden from the app.
              Past bookings and invoices that reference it stay intact for
              reporting. You can create a new room with the same name
              afterwards; they will be tracked as separate rooms.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (!deleteTarget) return;
                setIsDeleting(true);
                try {
                  await removeRoom({ id: deleteTarget.id });
                  toast.success(`${deleteTarget.name} deleted`);
                  setDeleteTarget(null);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Failed to delete room"
                  );
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? "Deleting…" : "Yes, delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
