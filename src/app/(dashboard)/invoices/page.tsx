"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";
import { useUser } from "@clerk/nextjs";
import { useMemo } from "react";
import { Lock } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileDown, FilePlus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "default",
  paid: "outline",
  overdue: "destructive",
  void: "secondary",
};

export default function InvoicesPage() {
  const { user } = useUser();
  const { orgId, convexOrg } = useOrgData();
  const { isOwner } = useUserRole();
  const { can } = useSubscriptionTier();

  if (!can("invoices")) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Lock className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Invoices</h2>
        <p className="text-muted-foreground max-w-md">
          Upgrade to the Professional plan to access automated invoicing with
          PDF generation and email delivery.
        </p>
      </div>
    );
  }

  // For now, query all invoices by org. In production, filter by user for bookers
  const invoices = useQuery(
    api.invoices.listByOrg,
    orgId ? { orgId } : "skip"
  );

  const generateInvoices = useAction(api.invoices.generateNow);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [genStartDate, setGenStartDate] = useState("");
  const [genEndDate, setGenEndDate] = useState("");
  const invoiceMode = convexOrg?.invoiceMode ?? "auto";

  const bookerIds = useMemo(() => {
    const ids = new Set<string>();
    invoices?.forEach((i) => ids.add(i.userId));
    return Array.from(ids);
  }, [invoices]);

  const convexUsers = useQuery(
    api.users.listByClerkUserIds,
    bookerIds.length > 0 ? { clerkUserIds: bookerIds } : "skip"
  );

  function resolveUserName(clerkUserId: string): string {
    const cu = convexUsers?.find((u) => u.clerkUserId === clerkUserId);
    return cu?.fullName || clerkUserId;
  }

  const filteredInvoices = isOwner
    ? invoices
    : invoices?.filter((i) => i.userId === user?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        {isOwner && orgId && (
          <Button
            variant="outline"
            disabled={isGenerating}
            onClick={() => {
              // Always show date dialog — for manual it's blank, for auto it's pre-filled
              if (invoiceMode === "auto" && convexOrg) {
                const today = new Date();
                const invoiceDay = convexOrg.invoiceDayOfMonth ?? 1;
                let pEnd = new Date(today.getFullYear(), today.getMonth(), invoiceDay);
                if (pEnd > today) pEnd = new Date(today.getFullYear(), today.getMonth() - 1, invoiceDay);
                let pStart: Date;
                if (invoiceDay >= 28) {
                  pStart = new Date(pEnd.getFullYear(), pEnd.getMonth(), 1);
                } else {
                  pStart = new Date(pEnd.getFullYear(), pEnd.getMonth() - 1, invoiceDay + 1);
                }
                setGenStartDate(pStart.toISOString().split("T")[0]);
                setGenEndDate(pEnd.toISOString().split("T")[0]);
              } else {
                setGenStartDate("");
                setGenEndDate("");
              }
              setShowDateDialog(true);
            }}
          >
            <FilePlus className="h-4 w-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate Invoices"}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isOwner ? "All Invoices" : "My Invoices"}
          </CardTitle>
          <CardDescription>
            {filteredInvoices?.length ?? 0} invoice(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredInvoices && filteredInvoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Period</TableHead>
                  {isOwner && <TableHead>Booker</TableHead>}
                  <TableHead>Subtotal</TableHead>
                  <TableHead>VAT</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices
                  .sort(
                    (a, b) =>
                      new Date(b.periodStart).getTime() -
                      new Date(a.periodStart).getTime()
                  )
                  .map((invoice) => (
                    <TableRow key={invoice._id}>
                      <TableCell className="font-mono text-sm">
                        <Link
                          href={`/invoices/${invoice._id}`}
                          className="hover:underline"
                        >
                          {invoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.periodStart), "d MMM")} -{" "}
                        {format(
                          new Date(invoice.periodEnd),
                          "d MMM yyyy"
                        )}
                      </TableCell>
                      {isOwner && <TableCell>{resolveUserName(invoice.userId)}</TableCell>}
                      <TableCell>
                        R{(invoice.subtotal / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        R{(invoice.taxAmount / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-medium">
                        R{(invoice.total / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[invoice.status]}>
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            window.open(
                              `/api/invoices/${invoice._id}/pdf`,
                              "_blank"
                            );
                          }}
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No invoices yet. Invoices are generated automatically on the
              configured day of each month.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Date Range Dialog for Manual Invoice Generation */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invoices</DialogTitle>
            <DialogDescription>
              Select the billing period for invoice generation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={genStartDate}
                  onChange={(e) => setGenStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={genEndDate}
                  onChange={(e) => setGenEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDateDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={isGenerating || !genStartDate || !genEndDate}
              onClick={async () => {
                if (!orgId) return;
                setIsGenerating(true);
                try {
                  const count = await generateInvoices({
                    orgId,
                    startDate: genStartDate,
                    endDate: genEndDate,
                  });
                  toast.success(`Generated ${count} invoice(s)`);
                  setShowDateDialog(false);
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Failed to generate"
                  );
                } finally {
                  setIsGenerating(false);
                }
              }}
            >
              {isGenerating ? "Generating..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
