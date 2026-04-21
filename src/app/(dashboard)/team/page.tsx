"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import Link from "next/link";
import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function TeamPage() {
  const { orgId } = useOrgData();
  const me = useQuery(api.users.currentUser);

  const memberships = useQuery(
    api.organizations.listMembershipsByOrg,
    orgId ? { orgId } : "skip"
  );
  const invitations = useQuery(
    api.invitations.listByOrg,
    orgId ? { orgId } : "skip"
  );
  const revokeInvitation = useMutation(api.invitations.revoke);
  const removeMember = useMutation(api.organizations.removeMember);

  // Query Convex users for name resolution
  const memberUserIds = useMemo(
    () => (memberships ?? []).map((m) => m.userId),
    [memberships]
  );
  const convexUsers = useQuery(
    api.users.listByIds,
    memberUserIds.length > 0 ? { ids: memberUserIds } : "skip"
  );

  function resolveUser(userId: string) {
    return convexUsers?.find((u) => u._id === userId);
  }

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Remove member dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeUserId, setRemoveUserId] = useState<Id<"users"> | null>(null);
  const [removeMemberName, setRemoveMemberName] = useState("");

  async function handleRemoveMember() {
    if (!removeUserId || !orgId) return;
    setIsSubmitting(true);
    try {
      await removeMember({ orgId, userId: removeUserId });
      toast.success(`${removeMemberName} has been removed from the team`);
      setRemoveDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove member"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        <Link href="/team/invite" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Invite Member
        </Link>
      </div>

      {/* Active Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            People who have access to your practice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships?.map((membership) => {
                const u = resolveUser(membership.userId);
                const displayName = u?.fullName || u?.email || membership.userId;
                const email = u?.email ?? "";
                const isMe = membership.userId === me?._id;
                const role = membership.role;
                const roleLabel =
                  role === "owner" ? "Owner" : role === "manager" ? "Manager" : "Booker";

                return (
                  <TableRow key={membership._id}>
                    <TableCell className="font-medium">
                      {displayName}
                      {isMe && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (you)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          role === "owner"
                            ? "default"
                            : role === "manager"
                              ? "outline"
                              : "secondary"
                        }
                      >
                        {roleLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(membership._creationTime), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {!isMe && role !== "owner" && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setRemoveUserId(membership.userId);
                              setRemoveMemberName(displayName);
                              setRemoveDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations &&
        invitations.filter((i) => i.status === "pending").length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations
                    .filter((i) => i.status === "pending")
                    .map((invitation) => (
                      <TableRow key={invitation._id}>
                        <TableCell>{invitation.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{invitation.role}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(
                            new Date(invitation._creationTime),
                            "d MMM yyyy"
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(
                            new Date(invitation.expiresAt),
                            "d MMM yyyy"
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={async () => {
                              await revokeInvitation({ id: invitation._id });
                              toast.success("Invitation revoked");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

      {/* Remove Member Confirmation */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <strong>{removeMemberName}</strong> from the team? They will
              lose all access to the platform immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
            >
              Keep Member
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Removing..." : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
