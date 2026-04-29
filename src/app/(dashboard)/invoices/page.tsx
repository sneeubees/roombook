"use client";

import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import { useMemo } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileDown, FilePlus, Mail, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  cancelled: "destructive",
};

export default function InvoicesPage() {
  const me = useQuery(api.users.currentUser);
  const { orgId, convexOrg } = useOrgData();
  const { isOwner } = useUserRole();

  // For now, query all invoices by org. In production, filter by user for bookers
  const invoices = useQuery(
    api.invoices.listByOrg,
    orgId ? { orgId } : "skip"
  );

  const generateInvoices = useAction(api.invoices.generateNow);
  const regenerateForPeriod = useAction(api.invoices.regenerateForPeriod);
  const emailInvoices = useAction(api.invoices.emailInvoices);
  const deleteCancelledInvoice = useMutation(api.invoices.deleteCancelled);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: Id<"invoices">;
    invoiceNumber: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailTargetUserId, setEmailTargetUserId] = useState<string>("all");
  const [isEmailing, setIsEmailing] = useState(false);

  // Strip Convex's "[CONVEX X(foo)] [Request ID: ...] Server Error Uncaught
  // Error: ..." prefix so toasts show the real message only.
  function cleanErrorMessage(msg: string): string {
    // Find the last occurrence of "Error: " which wraps the actual cause.
    const match = msg.match(/(?:Uncaught )?Error:\s*([\s\S]*?)\s*(?:at handler.*)?$/);
    return match?.[1]?.trim() || msg;
  }
  const paymentRuns = useQuery(
    api.invoices.listPaymentRuns,
    isOwner && orgId ? { orgId } : "skip"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRunsDialog, setShowRunsDialog] = useState(false);
  const [regenConfirm, setRegenConfirm] = useState<{
    key: string;
    label: string;
    periodStart: string;
    periodEnd: string;
    activeCount: number;
  } | null>(null);
  const invoiceMode = convexOrg?.invoiceMode ?? "auto";

  const bookerIds = useMemo(() => {
    const ids = new Set<string>();
    invoices?.forEach((i) => ids.add(i.userId));
    return Array.from(ids);
  }, [invoices]);

  const convexUsers = useQuery(
    api.users.listByIds,
    bookerIds.length > 0 ? { ids: bookerIds as any } : "skip"
  );

  function resolveUserName(userId: string): string {
    const cu = convexUsers?.find((u) => u._id === userId);
    return cu?.fullName || userId;
  }

  const filteredInvoices = isOwner
    ? invoices
    : invoices?.filter((i) => i.userId === me?._id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        {isOwner && orgId && (
          <Button
            variant="outline"
            disabled={isGenerating}
            onClick={() => setShowRunsDialog(true)}
          >
            <FilePlus className="h-4 w-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate / Regenerate Invoices"}
          </Button>
        )}
        {isOwner && orgId && (
          <Button
            variant="outline"
            className="ml-2"
            disabled={isEmailing}
            onClick={() => {
              setEmailTargetUserId("all");
              setShowEmailDialog(true);
            }}
          >
            <Mail className="h-4 w-4 mr-2" />
            Email Invoices
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
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download PDF"
                            onClick={() => {
                              window.open(
                                `/api/invoices/${invoice._id}/pdf`,
                                "_blank"
                              );
                            }}
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          {isOwner && invoice.status === "cancelled" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete cancelled invoice"
                              className="text-destructive hover:text-destructive"
                              onClick={() =>
                                setDeleteConfirm({
                                  id: invoice._id,
                                  invoiceNumber: invoice.invoiceNumber,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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

      {/* Payment Runs Dialog — pick the month to generate / regenerate */}
      <Dialog open={showRunsDialog} onOpenChange={setShowRunsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate / Regenerate Invoices</DialogTitle>
            <DialogDescription>
              Pick the payment run (month). Runs whose invoice date has not
              arrived yet are disabled. If invoices already exist for a run you
              can regenerate them — the old invoices will be cancelled and new
              ones issued with new invoice numbers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {(paymentRuns ?? []).map((run) => {
              const isDisabled = run.isFuture;
              const hasActive = run.activeInvoiceCount > 0;
              return (
                <button
                  key={run.key}
                  type="button"
                  disabled={isDisabled || isGenerating}
                  onClick={() => {
                    if (hasActive) {
                      setRegenConfirm({
                        key: run.key,
                        label: run.label,
                        periodStart: run.periodStart,
                        periodEnd: run.periodEnd,
                        activeCount: run.activeInvoiceCount,
                      });
                    } else {
                      // Generate fresh
                      (async () => {
                        if (!orgId) return;
                        setIsGenerating(true);
                        try {
                          const count = await generateInvoices({
                            orgId,
                            startDate: run.periodStart,
                            endDate: run.periodEnd,
                          });
                          toast.success(`Generated ${count} invoice(s) for ${run.label}`);
                          setShowRunsDialog(false);
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : "";
                          if (msg.includes("No billable bookings")) {
                            toast.info(`Nothing to invoice for ${run.label}`, {
                              description: "There are no billable bookings in this period.",
                            });
                          } else {
                            toast.error("Could not generate invoices", {
                              description: cleanErrorMessage(msg) || "Unknown error",
                            });
                          }
                        } finally {
                          setIsGenerating(false);
                        }
                      })();
                    }
                  }}
                  className={
                    "w-full flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left border transition-colors " +
                    (isDisabled
                      ? "opacity-50 cursor-not-allowed bg-muted/30"
                      : "hover:bg-muted/40 cursor-pointer")
                  }
                >
                  <div>
                    <div className="font-medium text-sm">{run.label}</div>
                    <div className="text-xs text-muted-foreground">
                      Period: {format(new Date(run.periodStart), "d MMM")} – {format(new Date(run.periodEnd), "d MMM yyyy")} · Run date: {format(new Date(run.runDate), "d MMM yyyy")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDisabled && (
                      <Badge variant="secondary" className="text-[10px]">
                        Scheduled
                      </Badge>
                    )}
                    {!isDisabled && hasActive && (
                      <Badge variant="default" className="text-[10px]">
                        {run.activeInvoiceCount} active · Regenerate
                      </Badge>
                    )}
                    {!isDisabled && !hasActive && run.cancelledInvoiceCount > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {run.cancelledInvoiceCount} cancelled · Generate
                      </Badge>
                    )}
                    {!isDisabled && !hasActive && run.cancelledInvoiceCount === 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        Not generated
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRunsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Invoices Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email invoices</DialogTitle>
            <DialogDescription>
              Send the most recent invoice to the selected booker. This ignores
              the &ldquo;Email Monthly Invoices&rdquo; preference — use this to
              resend on demand.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Who to email</label>
            <Select
              value={emailTargetUserId}
              onValueChange={(v) => v && setEmailTargetUserId(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bookerIds.map((uid) => (
                  <SelectItem key={uid} value={uid}>
                    {resolveUserName(uid)}
                  </SelectItem>
                ))}
                <SelectItem value="all">All bookers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={isEmailing}
              onClick={async () => {
                if (!orgId) return;
                setIsEmailing(true);
                try {
                  const result = await emailInvoices({
                    orgId,
                    userId:
                      emailTargetUserId === "all"
                        ? undefined
                        : (emailTargetUserId as Id<"users">),
                  });
                  toast.success(
                    `Sent ${result.sent} invoice email${result.sent === 1 ? "" : "s"}${
                      result.skipped ? ` · ${result.skipped} failed` : ""
                    }`
                  );
                  setShowEmailDialog(false);
                } catch (err) {
                  toast.error("Could not send invoices", {
                    description: cleanErrorMessage(
                      err instanceof Error ? err.message : ""
                    ) || "Unknown error",
                  });
                } finally {
                  setIsEmailing(false);
                }
              }}
            >
              {isEmailing ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Confirmation */}
      <Dialog
        open={regenConfirm !== null}
        onOpenChange={(open) => !open && setRegenConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate invoices for {regenConfirm?.label}?</DialogTitle>
            <DialogDescription>
              {regenConfirm?.activeCount ?? 0} invoice(s) already exist for this
              payment run. They will be <strong>cancelled</strong> and new invoices
              will be created with new invoice numbers.
              <br />
              <br />
              Cancelled invoices stay in the list for audit; reporting uses only
              the live (non-cancelled) invoices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isGenerating}
              onClick={async () => {
                if (!orgId || !regenConfirm) return;
                setIsGenerating(true);
                try {
                  const result = await regenerateForPeriod({
                    orgId,
                    periodStart: regenConfirm.periodStart,
                    periodEnd: regenConfirm.periodEnd,
                  });
                  toast.success(
                    `Cancelled ${result.cancelled}, generated ${result.created} new invoice(s) for ${regenConfirm.label}`
                  );
                  setRegenConfirm(null);
                  setShowRunsDialog(false);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "";
                  toast.error("Could not regenerate invoices", {
                    description: cleanErrorMessage(msg) || "Unknown error",
                  });
                } finally {
                  setIsGenerating(false);
                }
              }}
            >
              {isGenerating ? "Regenerating..." : "Yes, regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete cancelled invoice confirm */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete cancelled invoice?</DialogTitle>
            <DialogDescription>
              This permanently removes invoice{" "}
              <strong className="font-mono">
                {deleteConfirm?.invoiceNumber}
              </strong>{" "}
              and its line items. This cannot be undone. Only cancelled
              invoices can be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (!deleteConfirm) return;
                setIsDeleting(true);
                try {
                  await deleteCancelledInvoice({ id: deleteConfirm.id });
                  toast.success(
                    `Deleted invoice ${deleteConfirm.invoiceNumber}`
                  );
                  setDeleteConfirm(null);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "";
                  toast.error("Could not delete invoice", {
                    description: cleanErrorMessage(msg) || "Unknown error",
                  });
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? "Deleting..." : "Yes, delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
