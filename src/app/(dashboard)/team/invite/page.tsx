"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function InvitePage() {
  const { orgId, convexOrg } = useOrgData();
  const router = useRouter();
  const createInvitation = useMutation(api.invitations.create);
  const orgDomains = useQuery(
    api.domains.listByOrg,
    orgId ? { orgId } : "skip"
  );

  const invoicingOn = convexOrg?.invoicesEnabled !== false;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"booker" | "manager">("booker");
  const [receiveMonthlyInvoices, setReceiveMonthlyInvoices] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;

    setIsSubmitting(true);
    try {
      const token = generateToken();
      await createInvitation({
        orgId,
        email,
        role,
        token,
        receiveMonthlyInvoices,
      });

      // Prefer a verified white-label domain so the invitee lands on the
      // org's own domain, not roombook.co.za. Falls back to the current host.
      const verified = (orgDomains ?? []).find((d) => d.isVerified);
      const origin = verified
        ? `https://${verified.domain}`
        : window.location.origin;
      const inviteUrl = `${origin}/invite/${token}`;
      await navigator.clipboard.writeText(inviteUrl);

      toast.success("Invitation created! Link copied to clipboard.", {
        description: `Invite link for ${email} has been copied.`,
      });
      router.push("/team");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send invitation"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
          <CardDescription>
            Send an invitation link to add someone to your organisation. Each
            organisation has only one Owner, so new team members can be invited
            as a Manager or Booker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) =>
                  v && setRole(v as "booker" | "manager")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {role === "booker" ? "Booker" : "Manager"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-[560px]">
                  <SelectItem value="booker">
                    Booker — Can book rooms and view their own invoices
                  </SelectItem>
                  <SelectItem value="manager">
                    Manager — Can manage bookings, rooms, team members, and invoices (cannot access Settings or Reports)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {invoicingOn && (
              <div className="flex items-start justify-between gap-4 rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">
                    Email Monthly Invoices
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Send this member their invoice automatically each month
                    when it is generated. You can change this later on the
                    Team page.
                  </p>
                </div>
                <Switch
                  checked={receiveMonthlyInvoices}
                  onCheckedChange={setReceiveMonthlyInvoices}
                />
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send Invitation"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/team")}
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
