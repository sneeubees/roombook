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
import { Shield, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
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
            <CardTitle className="text-amber-800">
              Pending Approvals
            </CardTitle>
            <CardDescription>
              New registrations waiting for your approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations
                  ?.filter((o) => (o.status ?? "active") === "pending_approval")
                  .map((org) => (
                    <TableRow key={org._id}>
                      <TableCell className="font-medium">
                        {org.name}
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
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Organizations */}
      <Card>
        <CardHeader>
          <CardTitle>All Organizations</CardTitle>
          <CardDescription>
            {organizations?.length ?? 0} organization(s) on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations?.map((org) => {
                const status = org.status ?? "active";
                return (
                  <TableRow key={org._id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {org.subscriptionTier ?? "basic"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[status] ?? "secondary"}>
                        {status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(org._creationTime), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-end">
                        {status !== "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await approveOrg({ id: org._id });
                              toast.success(`${org.name} activated`);
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
                              await suspendOrg({ id: org._id });
                              toast.success(`${org.name} suspended`);
                            }}
                          >
                            Suspend
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
                <TableHead>Role</TableHead>
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
                          clerkUserId: u.clerkUserId,
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
