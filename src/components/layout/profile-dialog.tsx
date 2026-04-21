"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const me = useQuery(api.users.currentUser);
  const { convexOrg, orgId } = useOrgData();
  const { isOwner } = useUserRole();
  const updateProfile = useMutation(api.users.updateProfile);
  const updateOrg = useMutation(api.organizations.update);
  const generateToken = useMutation(api.users.generateCalendarToken);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgLogoUrl, setOrgLogoUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (me) {
      setFullName(me.fullName || "");
      setPhone(me.phone || "");
    }
  }, [me]);

  useEffect(() => {
    if (convexOrg) {
      setOrgName(convexOrg.name || "");
      setOrgLogoUrl(convexOrg.logoUrl || "");
    }
  }, [convexOrg]);

  async function handleSave() {
    if (!me?._id || !fullName.trim()) return;
    setIsSubmitting(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });

      // Owner can also update org name and logo
      if (isOwner && orgId) {
        await updateOrg({
          id: orgId,
          name: orgName.trim() || undefined,
          logoUrl: orgLogoUrl.trim() || undefined,
        });
      }

      toast.success("Profile updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your Profile</DialogTitle>
          <DialogDescription>
            Update your name and contact details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full Name <span className="text-destructive">*</span></Label>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-phone">Contact Number</Label>
            <Input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 082 123 4567"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={me?.email ?? ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email is managed by your sign-in provider.
            </p>
          </div>

          {isOwner && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="org-name">Company / Organization Name</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g., PhysioCare Practice"
                />
                <p className="text-xs text-muted-foreground">
                  This name is shown across the app and on invoices.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="org-logo">Logo URL</Label>
                <Input
                  id="org-logo"
                  value={orgLogoUrl}
                  onChange={(e) => setOrgLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a URL to your company logo. It will appear in the
                  sidebar and on invoices.
                </p>
              </div>
            </>
          )}

          <Separator />

          {/* Calendar Sync */}
          <div className="space-y-2">
            <Label>Sync to Calendar</Label>
            <p className="text-xs text-muted-foreground">
              Subscribe to your bookings in Google Calendar, Outlook, or
              Apple Calendar. Your calendar will auto-update when bookings
              change.
            </p>
            {me?.calendarToken ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/calendar/${me.calendarToken}`}
                    className="text-xs bg-muted font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/api/calendar/${me.calendarToken}`
                      );
                      toast.success("Calendar URL copied!");
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Google Calendar:</strong> Settings &gt; Other calendars &gt; From URL &gt; paste the link</p>
                  <p><strong>Outlook:</strong> Add calendar &gt; Subscribe from web &gt; paste the link</p>
                  <p><strong>Apple Calendar:</strong> File &gt; New Calendar Subscription &gt; paste the link</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={async () => {
                    await generateToken();
                    toast.success("New calendar link generated. Update your calendar subscription.");
                  }}
                >
                  Regenerate link
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await generateToken();
                  toast.success("Calendar link generated!");
                }}
              >
                Generate Calendar Link
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !fullName.trim()}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
