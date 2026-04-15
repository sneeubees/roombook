"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import Link from "next/link";
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
import { Plus, Edit } from "lucide-react";
import { toast } from "sonner";

export default function RoomsPage() {
  const { orgId } = useOrgData();
  const { isOwner } = useUserRole();
  const rooms = useQuery(api.rooms.list, orgId ? { orgId } : "skip");
  const updateRoom = useMutation(api.rooms.update);

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
                  <Link href={`/rooms/${room._id}/edit`} className={buttonVariants({ variant: "ghost", size: "icon" })}>
                    <Edit className="h-4 w-4" />
                  </Link>
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
                      : `Fee if <${room.cancellationDeadlineHours}h notice`}
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
    </div>
  );
}
