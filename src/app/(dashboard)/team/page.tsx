"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useOrganization, useUser } from "@clerk/nextjs";
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
import { Plus, X, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function TeamPage() {
  const { orgId } = useOrgData();
  const { user } = useUser();
  const { organization, memberships } = useOrganization({
    memberships: { pageSize: 100 },
  });

  const invitations = useQuery(
    api.invitations.listByOrg,
    orgId ? { orgId } : "skip"
  );
  const revokeInvitation = useMutation(api.invitations.revoke);
  const updateProfile = useMutation(api.users.updateProfile);

  // Query Convex users for name resolution
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
    if (cu?.fullName) return cu.fullName;
    const member = memberships?.data?.find(
      (m) => m.publicUserData?.userId === clerkUserId
    );
    return member?.publicUserData?.identifier ?? clerkUserId;
  }

  function resolveUserPhone(clerkUserId: string): string {
    return convexUsers?.find((u) => u.clerkUserId === clerkUserId)?.phone ?? "";
  }

  // Edit member dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Remove member dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeMembershipId, setRemoveMembershipId] = useState("");
  const [removeMemberName, setRemoveMemberName] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getMemberDisplayName(m: any) {
    const uid = m.publicUserData?.userId ?? "";
    return resolveUserName(uid);
  }

  async function handleEditSave() {
    if (!editUserId || !editName.trim()) return;
    setIsSubmitting(true);
    try {
      await updateProfile({
        clerkUserId: editUserId,
        fullName: editName.trim(),
        phone: editPhone.trim() || undefined,
      });
      toast.success("Member updated");
      setEditDialogOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update member"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveMember() {
    if (!removeMembershipId || !organization) return;
    setIsSubmitting(true);
    try {
      await organization.removeMember(removeMembershipId);
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
              {memberships?.data?.map((membership) => {
                const displayName = getMemberDisplayName(membership);
                const email = membership.publicUserData?.identifier ?? "";
                const isMe =
                  membership.publicUserData?.userId === user?.id;
                const isOwnerRole = membership.role === "org:admin";
                const isManagerRole = membership.role === "org:manager";
                const roleLabel = isOwnerRole ? "Owner" : isManagerRole ? "Manager" : "Booker";

                return (
                  <TableRow key={membership.id}>
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
                        variant={isOwnerRole ? "default" : isManagerRole ? "outline" : "secondary"}
                      >
                        {roleLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(membership.createdAt), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {!isMe && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const uid = membership.publicUserData?.userId ?? "";
                              setEditUserId(uid);
                              setEditName(resolveUserName(uid));
                              setEditPhone(resolveUserPhone(uid));
                              setEditDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setRemoveMembershipId(membership.id);
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

      {/* Edit Member Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>
              Update this member&apos;s name and contact details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Member's full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Contact Number</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="e.g., 082 123 4567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={isSubmitting || !editName.trim()}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
