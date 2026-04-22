"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useUserRole } from "@/hooks/use-user-role";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Id } from "../../../../convex/_generated/dataModel";
import { useMemo } from "react";

const statusColors: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  pending_approval: "secondary",
  suspended: "destructive",
};

export default function AdminPage() {
  const { isSuperAdmin } = useUserRole();
  const organizations = useQuery(api.organizations.listAll);
  const users = useQuery(api.users.listAll);
  const approveOrg = useMutation(api.organizations.approve);
  const suspendOrg = useMutation(api.organizations.suspend);
  const setSuperAdmin = useMutation(api.users.setSuperAdmin);
  const updateMemberRole = useMutation(api.organizations.updateMemberRole);

  // All memberships across every org, fetched per-org (cheap for dev volumes).
  const orgIds = useMemo(() => organizations?.map((o) => o._id) ?? [], [organizations]);

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">
          You do not have access to this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Super Admin</h1>
      </div>

      {/* Pending Approvals */}
      {organizations?.some((o) => (o.status ?? "active") === "pending_approval") && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-amber-800">Pending Approvals</CardTitle>
            <CardDescription>
              New registrations waiting for your approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations
                  ?.filter((o) => (o.status ?? "active") === "pending_approval")
                  .map((org) => {
                    const o = org as typeof org & {
                      paymentMethod?: string;
                      paymentReference?: string;
                      paymentNotes?: string;
                      paymentRequestedAt?: number;
                    };
                    return (
                      <TableRow key={org._id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {org.subscriptionTier ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {o.paymentMethod ? (
                            <>
                              <div className="font-medium uppercase">
                                {o.paymentMethod}
                              </div>
                              <div className="font-mono text-muted-foreground">
                                Ref: {o.paymentReference ?? "—"}
                              </div>
                              {o.paymentNotes && (
                                <div className="text-muted-foreground italic">
                                  {o.paymentNotes}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(org._creationTime), "d MMM yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              onClick={async () => {
                                await approveOrg({ id: org._id });
                                toast.success(`${org.name} approved`);
                              }}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={async () => {
                                await suspendOrg({ id: org._id });
                                toast.success(`${org.name} suspended`);
                              }}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Organizations with member management */}
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
          <CardDescription>
            {organizations?.length ?? 0} organization(s). Expand a row to manage
            members and roles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {organizations?.map((org) => (
            <OrgBlock
              key={org._id}
              orgId={org._id}
              name={org.name}
              status={org.status ?? "active"}
              createdAt={org._creationTime}
              approveOrg={approveOrg}
              suspendOrg={suspendOrg}
              updateMemberRole={updateMemberRole}
              allUsers={users ?? []}
            />
          ))}
        </CardContent>
      </Card>

      {/* All Users */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {users?.length ?? 0} user(s) on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Super Admin</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
                <TableRow key={u._id}>
                  <TableCell className="font-medium">
                    {u.fullName || "—"}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.phone || "—"}
                  </TableCell>
                  <TableCell>
                    {u.isSuperAdmin ? (
                      <Badge variant="default">Super Admin</Badge>
                    ) : (
                      <Badge variant="outline">User</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={u.isProfileComplete ? "default" : "secondary"}
                    >
                      {u.isProfileComplete ? "Complete" : "Incomplete"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={u.isSuperAdmin ? "outline" : "ghost"}
                      onClick={async () => {
                        const newVal = !u.isSuperAdmin;
                        await setSuperAdmin({
                          targetUserId: u._id,
                          isSuperAdmin: newVal,
                        });
                        toast.success(
                          newVal
                            ? `${u.fullName || u.email} is now a Super Admin`
                            : `${u.fullName || u.email} is no longer a Super Admin`
                        );
                      }}
                    >
                      {u.isSuperAdmin ? "Revoke Admin" : "Make Super Admin"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

type UserRow = {
  _id: Id<"users">;
  email: string;
  fullName: string;
  phone?: string;
  imageUrl?: string;
  isProfileComplete?: boolean;
  isSuperAdmin?: boolean;
  _creationTime: number;
};

function OrgBlock({
  orgId,
  name,
  status,
  createdAt,
  approveOrg,
  suspendOrg,
  updateMemberRole,
  allUsers,
}: {
  orgId: Id<"organizations">;
  name: string;
  status: string;
  createdAt: number;
  approveOrg: (args: { id: Id<"organizations"> }) => Promise<unknown>;
  suspendOrg: (args: { id: Id<"organizations"> }) => Promise<unknown>;
  updateMemberRole: (args: {
    orgId: Id<"organizations">;
    userId: Id<"users">;
    role: "owner" | "manager" | "booker";
  }) => Promise<unknown>;
  allUsers: UserRow[];
}) {
  const memberships = useQuery(api.organizations.listMembershipsByOrg, { orgId });
  const usersById = new Map(allUsers.map((u) => [u._id, u] as const));

  return (
    <div className="border rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(createdAt), "d MMM yyyy")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusColors[status] ?? "secondary"}>
            {status.replace("_", " ")}
          </Badge>
          {status !== "active" && (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await approveOrg({ id: orgId });
                toast.success(`${name} activated`);
              }}
            >
              Activate
            </Button>
          )}
          {status === "active" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                await suspendOrg({ id: orgId });
                toast.success(`${name} suspended`);
              }}
            >
              Suspend
            </Button>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(memberships ?? []).map((m) => {
            const u = usersById.get(m.userId);
            return (
              <TableRow key={m._id}>
                <TableCell className="font-medium">
                  {u?.fullName || "—"}
                </TableCell>
                <TableCell>{u?.email ?? m.userId}</TableCell>
                <TableCell>
                  <Select
                    value={m.role}
                    onValueChange={async (v) => {
                      if (!v || v === m.role) return;
                      try {
                        await updateMemberRole({
                          orgId,
                          userId: m.userId,
                          role: v as "owner" | "manager" | "booker",
                        });
                        toast.success(
                          `${u?.fullName || u?.email || "User"} is now ${v}`
                        );
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "Failed to update role"
                        );
                      }
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue>{m.role}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">owner</SelectItem>
                      <SelectItem value="manager">manager</SelectItem>
                      <SelectItem value="booker">booker</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
          {memberships && memberships.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className="text-xs text-muted-foreground text-center"
              >
                No members in this org yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
