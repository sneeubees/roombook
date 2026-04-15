"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Id } from "../../../../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, "0");
  return { value: `${h}:00`, label: `${h}:00` };
});

export default function EditRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as Id<"rooms">;
  const room = useQuery(api.rooms.get, { id: roomId });
  const updateRoom = useMutation(api.rooms.update);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricingMode, setPricingMode] = useState<"day_based" | "hourly">(
    "day_based"
  );
  const [fullDayRate, setFullDayRate] = useState("");
  const [halfDayRate, setHalfDayRate] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [sessionDuration, setSessionDuration] = useState("60");
  const [availableDays, setAvailableDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [availabilityStart, setAvailabilityStart] = useState("09:00");
  const [availabilityEnd, setAvailabilityEnd] = useState("17:00");
  const [is24Hours, setIs24Hours] = useState(false);
  const [amenities, setAmenities] = useState("");
  const [cancellationPolicy, setCancellationPolicy] = useState<
    "always_free" | "bill_if_late"
  >("always_free");
  const [cancellationDeadlineHours, setCancellationDeadlineHours] =
    useState("24");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (room) {
      setName(room.name);
      setDescription(room.description ?? "");
      setPricingMode(room.pricingMode ?? "day_based");
      setFullDayRate(room.fullDayRate ? (room.fullDayRate / 100).toFixed(2) : "");
      setHalfDayRate(room.halfDayRate ? (room.halfDayRate / 100).toFixed(2) : "");
      setHourlyRate(room.hourlyRate ? (room.hourlyRate / 100).toFixed(2) : "");
      setSessionDuration(String(room.sessionDurationMinutes ?? 60));
      setAvailableDays(room.availableDays ?? [1, 2, 3, 4, 5]);
      setAvailabilityStart(room.availabilityStart ?? "09:00");
      setAvailabilityEnd(room.availabilityEnd ?? "17:00");
      setIs24Hours(!room.availabilityStart && !room.availabilityEnd);
      setAmenities(room.amenities.join(", "));
      setCancellationPolicy(room.cancellationPolicy);
      setCancellationDeadlineHours(
        String(room.cancellationDeadlineHours ?? 24)
      );
    }
  }, [room]);

  if (!room) {
    return <div className="text-muted-foreground">Loading room...</div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateRoom({
        id: roomId,
        name,
        description: description || undefined,
        pricingMode,
        fullDayRate:
          pricingMode === "day_based"
            ? Math.round(parseFloat(fullDayRate) * 100)
            : undefined,
        halfDayRate:
          pricingMode === "day_based"
            ? Math.round(parseFloat(halfDayRate) * 100)
            : undefined,
        hourlyRate:
          pricingMode === "hourly"
            ? Math.round(parseFloat(hourlyRate) * 100)
            : undefined,
        sessionDurationMinutes:
          pricingMode === "hourly" ? parseInt(sessionDuration) : undefined,
        availableDays: availableDays.length === 7 ? undefined : availableDays,
        availabilityStart: is24Hours ? undefined : availabilityStart,
        availabilityEnd: is24Hours ? undefined : availabilityEnd,
        amenities: amenities
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        cancellationPolicy,
        cancellationDeadlineHours:
          cancellationPolicy === "bill_if_late"
            ? parseInt(cancellationDeadlineHours)
            : undefined,
      });
      toast.success("Room updated!");
      router.push("/rooms");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update room"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit Room</CardTitle>
          <CardDescription>Update room details and rates.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Room Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Pricing Mode</Label>
              <Select
                value={pricingMode}
                onValueChange={(v) =>
                  setPricingMode(v as "day_based" | "hourly")
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {pricingMode === "day_based" ? "Full Day / Half Day" : "Hourly (Per Session)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day_based">
                    Full Day / Half Day
                  </SelectItem>
                  <SelectItem value="hourly">
                    Hourly (Per Session)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {pricingMode === "day_based" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullDayRate">Full Day Rate (R)</Label>
                  <Input
                    id="fullDayRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={fullDayRate}
                    onChange={(e) => setFullDayRate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="halfDayRate">Half Day Rate (R)</Label>
                  <Input
                    id="halfDayRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={halfDayRate}
                    onChange={(e) => setHalfDayRate(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {pricingMode === "hourly" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hourlyRate">Hourly Rate (R)</Label>
                    <Input
                      id="hourlyRate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sessionDuration">
                      Default Session (minutes)
                    </Label>
                    <Input
                      id="sessionDuration"
                      type="number"
                      min="15"
                      step="15"
                      value={sessionDuration}
                      onChange={(e) => setSessionDuration(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <Separator />

            {/* Availability */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Availability</Label>

              <div className="space-y-2">
                <Label>Available Days</Label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 1, label: "Mon" },
                    { value: 2, label: "Tue" },
                    { value: 3, label: "Wed" },
                    { value: 4, label: "Thu" },
                    { value: 5, label: "Fri" },
                    { value: 6, label: "Sat" },
                    { value: 0, label: "Sun" },
                  ].map((day) => (
                    <label
                      key={day.value}
                      className="flex items-center gap-1.5 cursor-pointer"
                    >
                      <Checkbox
                        checked={availableDays.includes(day.value)}
                        onCheckedChange={(checked) => {
                          setAvailableDays(
                            checked
                              ? [...availableDays, day.value]
                              : availableDays.filter((d) => d !== day.value)
                          );
                        }}
                      />
                      <span className="text-sm">{day.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Available Hours</Label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-muted-foreground">24 hours</span>
                    <Switch checked={is24Hours} onCheckedChange={setIs24Hours} />
                  </label>
                </div>
                {!is24Hours && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <Select value={availabilityStart} onValueChange={(v) => v && setAvailabilityStart(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOUR_OPTIONS.map((h) => (
                            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Until</Label>
                      <Select value={availabilityEnd} onValueChange={(v) => v && setAvailabilityEnd(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOUR_OPTIONS.map((h) => (
                            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="amenities">Amenities (comma-separated)</Label>
              <Input
                id="amenities"
                value={amenities}
                onChange={(e) => setAmenities(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Cancellation Policy</Label>
              <Select
                value={cancellationPolicy}
                onValueChange={(v) =>
                  setCancellationPolicy(v as "always_free" | "bill_if_late")
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {cancellationPolicy === "always_free" ? "Free cancellation" : "Late cancellation fee"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always_free">Free cancellation</SelectItem>
                  <SelectItem value="bill_if_late">Late cancellation fee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {cancellationPolicy === "bill_if_late" && (
              <div className="space-y-2">
                <Label htmlFor="deadline">
                  Cancellation Deadline (hours)
                </Label>
                <Input
                  id="deadline"
                  type="number"
                  min="1"
                  value={cancellationDeadlineHours}
                  onChange={(e) =>
                    setCancellationDeadlineHours(e.target.value)
                  }
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/rooms")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
