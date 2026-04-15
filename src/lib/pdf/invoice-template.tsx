import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  orgName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
  },
  orgDetails: {
    fontSize: 9,
    color: "#666",
    lineHeight: 1.5,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    textAlign: "right",
  },
  invoiceMeta: {
    fontSize: 9,
    textAlign: "right",
    color: "#666",
    lineHeight: 1.5,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginVertical: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#111",
  },
  customerRow: {
    fontSize: 10,
    lineHeight: 1.6,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  colDate: { width: "20%" },
  colRoom: { width: "25%" },
  colSlot: { width: "25%" },
  colRate: { width: "15%", textAlign: "right" },
  colAmount: { width: "15%", textAlign: "right" },
  headerText: {
    fontWeight: "bold",
    fontSize: 9,
    color: "#374151",
  },
  cellText: {
    fontSize: 9,
    color: "#4b5563",
  },
  totals: {
    marginTop: 15,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: 200,
    paddingVertical: 3,
  },
  totalLabel: {
    width: 120,
    textAlign: "right",
    paddingRight: 10,
    fontSize: 10,
    color: "#6b7280",
  },
  totalValue: {
    width: 80,
    textAlign: "right",
    fontSize: 10,
  },
  totalFinal: {
    fontWeight: "bold",
    fontSize: 12,
    color: "#111",
    borderTopWidth: 1,
    borderTopColor: "#111",
    paddingTop: 4,
  },
  bankingSection: {
    marginTop: 30,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  bankingTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#111",
  },
  bankingRow: {
    flexDirection: "row",
    fontSize: 9,
    lineHeight: 1.6,
  },
  bankingLabel: {
    width: 100,
    color: "#6b7280",
  },
  bankingValue: {
    color: "#111",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "right",
    marginTop: 4,
  },
});

function formatCurrency(cents: number): string {
  return `R ${(cents / 100).toFixed(2)}`;
}

function formatSlot(
  slotType: string,
  startTime?: string,
  endTime?: string,
  durationMinutes?: number
): string {
  if (slotType === "session" && startTime && endTime) {
    const dur = durationMinutes
      ? ` (${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 ? ` ${durationMinutes % 60}m` : ""})`
      : "";
    return `${startTime} - ${endTime}${dur}`;
  }
  if (slotType === "full_day") return "Full Day";
  if (slotType === "am") return "Morning (AM)";
  if (slotType === "pm") return "Afternoon (PM)";
  return slotType;
}

export interface InvoiceData {
  // Organization
  orgName: string;
  orgAddress?: string;
  orgPhone?: string;
  orgEmail?: string;
  orgVatNumber?: string;
  // Banking
  bankName?: string;
  accountNumber?: string;
  branchCode?: string;
  accountType?: string;
  // Customer
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  // Invoice
  invoiceNumber: string;
  invoiceDate: string;
  periodStart: string;
  periodEnd: string;
  dueDate?: string;
  status: string;
  // Totals
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  // White label
  isWhiteLabel?: boolean;
  // Line items
  lineItems: Array<{
    date: string;
    roomName: string;
    slotType: string;
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    rate: number;
    amount: number;
  }>;
}

export function InvoiceDocument({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.orgName}>{data.orgName}</Text>
            <View style={styles.orgDetails}>
              {data.orgAddress && <Text>{data.orgAddress}</Text>}
              {data.orgPhone && <Text>Tel: {data.orgPhone}</Text>}
              {data.orgEmail && <Text>{data.orgEmail}</Text>}
              {data.orgVatNumber && (
                <Text>VAT No: {data.orgVatNumber}</Text>
              )}
            </View>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <View style={styles.invoiceMeta}>
              <Text>Invoice #: {data.invoiceNumber}</Text>
              <Text>Date: {data.invoiceDate}</Text>
              <Text>
                Period: {data.periodStart} - {data.periodEnd}
              </Text>
              {data.dueDate && <Text>Due: {data.dueDate}</Text>}
            </View>
            <Text
              style={[
                styles.statusBadge,
                {
                  color:
                    data.status === "paid"
                      ? "#16a34a"
                      : data.status === "overdue"
                        ? "#dc2626"
                        : "#6b7280",
                },
              ]}
            >
              {data.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Bill To */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.customerRow}>{data.customerName}</Text>
          <Text style={styles.customerRow}>{data.customerEmail}</Text>
          {data.customerPhone && (
            <Text style={styles.customerRow}>{data.customerPhone}</Text>
          )}
        </View>

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Details</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.colDate, styles.headerText]}>Date</Text>
              <Text style={[styles.colRoom, styles.headerText]}>Room</Text>
              <Text style={[styles.colSlot, styles.headerText]}>Slot</Text>
              <Text style={[styles.colRate, styles.headerText]}>Rate</Text>
              <Text style={[styles.colAmount, styles.headerText]}>
                Amount
              </Text>
            </View>
            {data.lineItems.map((item, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={[styles.colDate, styles.cellText]}>
                  {item.date}
                </Text>
                <Text style={[styles.colRoom, styles.cellText]}>
                  {item.roomName}
                </Text>
                <Text style={[styles.colSlot, styles.cellText]}>
                  {formatSlot(
                    item.slotType,
                    item.startTime,
                    item.endTime,
                    item.durationMinutes
                  )}
                </Text>
                <Text style={[styles.colRate, styles.cellText]}>
                  {formatCurrency(item.rate)}
                </Text>
                <Text style={[styles.colAmount, styles.cellText]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(data.subtotal)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              VAT ({(data.taxRate * 100).toFixed(0)}%)
            </Text>
            <Text style={styles.totalValue}>
              {formatCurrency(data.taxAmount)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.totalFinal]}>Total</Text>
            <Text style={[styles.totalValue, styles.totalFinal]}>
              {formatCurrency(data.total)}
            </Text>
          </View>
        </View>

        {/* Banking Details */}
        {data.bankName && data.accountNumber && (
          <View style={styles.bankingSection}>
            <Text style={styles.bankingTitle}>Banking Details</Text>
            <View style={styles.bankingRow}>
              <Text style={styles.bankingLabel}>Bank:</Text>
              <Text style={styles.bankingValue}>{data.bankName}</Text>
            </View>
            <View style={styles.bankingRow}>
              <Text style={styles.bankingLabel}>Account No:</Text>
              <Text style={styles.bankingValue}>{data.accountNumber}</Text>
            </View>
            <View style={styles.bankingRow}>
              <Text style={styles.bankingLabel}>Branch Code:</Text>
              <Text style={styles.bankingValue}>{data.branchCode}</Text>
            </View>
            {data.accountType && (
              <View style={styles.bankingRow}>
                <Text style={styles.bankingLabel}>Account Type:</Text>
                <Text style={styles.bankingValue}>{data.accountType}</Text>
              </View>
            )}
            <View style={styles.bankingRow}>
              <Text style={styles.bankingLabel}>Reference:</Text>
              <Text style={styles.bankingValue}>{data.invoiceNumber}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          {data.orgName} | {data.invoiceNumber}{data.isWhiteLabel ? "" : " | Generated by RoomBook"}
        </Text>
      </Page>
    </Document>
  );
}
