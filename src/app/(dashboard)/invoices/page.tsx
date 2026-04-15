"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import { useSubscriptionTier } from "@/hooks/use-subscription-tier";
import { useUser } from "@clerk/nextjs";
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
  const { orgId } = useOrgData();
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
            onClick={async () => {
              setIsGenerating(true);
              try {
                const count = await generateInvoices({ orgId });
                toast.success(`Generated ${count} invoice(s)`);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Failed to generate invoices"
                );
              } finally {
                setIsGenerating(false);
              }
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
                      {isOwner && <TableCell>{invoice.userId}</TableCell>}
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
    </div>
  );
}
