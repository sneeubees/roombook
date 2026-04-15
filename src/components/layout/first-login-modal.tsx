"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
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
import { DoorOpen } from "lucide-react";
import { toast } from "sonner";

interface FirstLoginModalProps {
  open: boolean;
}

export function FirstLoginModal({ open }: FirstLoginModalProps) {
  const { user } = useUser();
  const { convexOrg, orgId } = useOrgData();
  const { isOwner } = useUserRole();
  const updateProfile = useMutation(api.users.updateProfile);
  const updateOrg = useMutation(api.organizations.update);

  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState("");
  const [orgName, setOrgName] = useState(convexOrg?.name ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave() {
    if (!user?.id || !fullName.trim()) return;
    setIsSubmitting(true);
    try {
      await updateProfile({
        clerkUserId: user.id,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });

      if (isOwner && orgId && orgName.trim()) {
        await updateOrg({
          id: orgId,
          name: orgName.trim(),
        });
      }

      toast.success("Welcome to RoomBook!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save profile"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <DoorOpen className="h-10 w-10 text-primary" />
          </div>
          <DialogTitle className="text-center">
            Welcome to RoomBook!
          </DialogTitle>
          <DialogDescription className="text-center">
            Let&apos;s set up your profile to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="first-name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="first-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="first-phone">Contact Number</Label>
            <Input
              id="first-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 082 123 4567"
            />
          </div>

          {isOwner && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="first-org">Company / Organization Name</Label>
                <Input
                  id="first-org"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g., PhysioCare Practice"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !fullName.trim()}
            className="w-full"
          >
            {isSubmitting ? "Saving..." : "Get Started"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
