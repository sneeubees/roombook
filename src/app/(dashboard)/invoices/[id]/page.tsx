"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useParams } from "next/navigation";
import { Id } from "../../../../../convex/_generated/dataModel";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { toast } from "sonner";

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = params.id as Id<"invoices">;
  const { isOwner } = useUserRole();

  const invoice = useQuery(api.invoices.get, { id: invoiceId });
  const lineItems = useQuery(api.invoices.getLineItems, {
    invoiceId,
  });
  const updateStatus = useMutation(api.invoices.updateStatus);

  if (!invoice) {
    return <div className="text-muted-foreground">Loading invoice...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono">
            {invoice.invoiceNumber}
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(invoice.periodStart), "d MMM yyyy")} -{" "}
            {format(new Date(invoice.periodEnd), "d MMM yyyy")}
          </p>
        </div>
        <Badge
          variant={
            invoice.status === "paid"
              ? "outline"
              : invoice.status === "overdue"
                ? "destructive"
                : "default"
          }
          className="text-sm"
        >
          {invoice.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {lineItems && lineItems.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Booked By</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell>
                      {format(new Date(item.date), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>{item.roomName}</TableCell>
                    <TableCell>
                      {item.slotType === "session" && item.startTime && item.endTime
                        ? `${item.startTime}–${item.endTime}${item.durationMinutes ? ` (${Math.floor(item.durationMinutes / 60)}h${item.durationMinutes % 60 ? ` ${item.durationMinutes % 60}m` : ""})` : ""}`
                        : item.slotType === "full_day"
                          ? "Full Day"
                          : item.slotType.toUpperCase()}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground">
                      {item.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.bookedByName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      R{(item.amount / 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              No line items found.
            </p>
          )}

          <Separator className="my-4" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>R{(invoice.subtotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>VAT ({(invoice.taxRate * 100).toFixed(0)}%)</span>
              <span>R{(invoice.taxAmount / 100).toFixed(2)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>R{(invoice.total / 100).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 flex-wrap">
        <Button
          variant="outline"
          onClick={() => window.open(`/api/invoices/${invoiceId}/pdf`, "_blank")}
        >
          Download PDF
        </Button>

        {isOwner && invoice.status !== "paid" && invoice.status !== "void" && (
          <>
            <Button
              onClick={async () => {
                await updateStatus({ id: invoiceId, status: "paid" });
                toast.success("Invoice marked as paid");
              }}
            >
              Mark as Paid
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await updateStatus({ id: invoiceId, status: "void" });
                toast.success("Invoice voided");
              }}
            >
              Void Invoice
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
