"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useOrgData } from "@/hooks/use-org-data";
import { useUserRole } from "@/hooks/use-user-role";
import { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TIER_FEATURES, type SubscriptionTier } from "@/lib/tiers";
import { CALENDAR_THEMES, type CalendarThemeId } from "@/lib/calendar-themes";
import { toast } from "sonner";

export default function SettingsPage() {
  const { convexOrg } = useOrgData();
  const { canAccessSettings } = useUserRole();
  const updateOrg = useMutation(api.organizations.update);
  const generateLogoUploadUrl = useMutation(api.organizations.generateLogoUploadUrl);
  const saveLogoAndGetUrl = useMutation(api.organizations.saveLogoAndGetUrl);

  const [companyName, setCompanyName] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [invoicesEnabled, setInvoicesEnabled] = useState(true);
  const [invoiceMode, setInvoiceMode] = useState<"auto" | "manual">("auto");
  const [invoiceDayOfMonth, setInvoiceDayOfMonth] = useState("1");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [vatNumber, setVatNumber] = useState("");
  const [vatRate, setVatRate] = useState("15");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountType, setAccountType] = useState("");
  const [calendarTheme, setCalendarTheme] = useState<CalendarThemeId>("ocean");
  const [darkMode, setDarkMode] = useState(false);
  const [staffLabel, setStaffLabel] = useState("Booker");
  const [customStaffLabel, setCustomStaffLabel] = useState("");
  const [showBookerNames, setShowBookerNames] = useState(false);
  const [showBookerContact, setShowBookerContact] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (convexOrg) {
      setCompanyName(convexOrg.name ?? "");
      setCompanyLogoUrl(convexOrg.logoUrl ?? "");
      setCalendarTheme((convexOrg.calendarTheme as CalendarThemeId) ?? "ocean");
      setDarkMode(convexOrg.darkMode ?? false);
      setInvoicesEnabled(convexOrg.invoicesEnabled !== false);
      setInvoiceMode((convexOrg.invoiceMode as "auto" | "manual") ?? "auto");
      setInvoiceDayOfMonth(String(convexOrg.invoiceDayOfMonth));
      setInvoicePrefix(convexOrg.invoicePrefix);
      setVatNumber(convexOrg.vatNumber ?? "");
      setVatRate(String((convexOrg.vatRate ?? 0.15) * 100));
      setBankName(convexOrg.bankingDetails?.bankName ?? "");
      setAccountNumber(convexOrg.bankingDetails?.accountNumber ?? "");
      setBranchCode(convexOrg.bankingDetails?.branchCode ?? "");
      setAccountType(convexOrg.bankingDetails?.accountType ?? "");
      const label = convexOrg.staffLabel ?? "Booker";
      const presets = [
        "Booker",
        "Therapist",
        "Physician",
        "Doctor",
        "Stylist",
        "Trainer",
        "Instructor",
        "Executive",
      ];
      if (presets.includes(label)) {
        setStaffLabel(label);
        setCustomStaffLabel("");
      } else {
        setStaffLabel("Other");
        setCustomStaffLabel(label);
      }
      setShowBookerNames(convexOrg.showBookerNames ?? false);
      setShowBookerContact(convexOrg.showBookerContact ?? false);
      setSubscriptionTier((convexOrg.subscriptionTier as SubscriptionTier) ?? "basic");
    }
  }, [convexOrg]);

  if (!convexOrg) {
    return <div className="text-muted-foreground">Loading settings...</div>;
  }

  if (!canAccessSettings) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground max-w-md">
          Only owners can access Settings. Please contact your organization
          owner if you need changes made.
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateOrg({
        id: convexOrg!._id,
        name: companyName.trim() || undefined,
        logoUrl: companyLogoUrl.trim() || undefined,
        calendarTheme,
        darkMode,
        staffLabel: staffLabel === "Other" ? customStaffLabel || "Booker" : staffLabel,
        showBookerNames,
        showBookerContact: showBookerNames ? showBookerContact : false,
        subscriptionTier,
        invoicesEnabled,
        invoiceMode,
        invoiceDayOfMonth: parseInt(invoiceDayOfMonth),
        invoicePrefix,
        vatNumber: vatNumber || undefined,
        vatRate: parseFloat(vatRate) / 100,
        bankingDetails:
          bankName && accountNumber
            ? {
                bankName,
                accountNumber,
                branchCode,
                accountType,
              }
            : undefined,
      });
      toast.success("Settings saved!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Details */}
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
            <CardDescription>
              Your company name and logo appear in the sidebar, header, and on
              invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company / Organization Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., PhysioCare Practice"
              />
            </div>
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex gap-4 items-center">
                {companyLogoUrl ? (
                  <img
                    src={companyLogoUrl}
                    alt="Logo"
                    className="h-16 w-16 rounded border object-contain bg-white"
                  />
                ) : (
                  <div className="h-16 w-16 rounded border border-dashed flex items-center justify-center text-muted-foreground text-xs">
                    No logo
                  </div>
                )}
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const uploadUrl = await generateLogoUploadUrl();
                        const result = await fetch(uploadUrl, {
                          method: "POST",
                          headers: { "Content-Type": file.type },
                          body: file,
                        });
                        const { storageId } = await result.json();
                        if (convexOrg?._id) {
                          const url = await saveLogoAndGetUrl({
                            orgId: convexOrg._id,
                            storageId,
                          });
                          if (url) setCompanyLogoUrl(url);
                        }
                        toast.success("Logo uploaded!");
                      } catch {
                        toast.error("Failed to upload logo");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                  >
                    Upload Logo
                  </Button>
                  {companyLogoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setCompanyLogoUrl("")}
                    >
                      Remove
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG or SVG. Appears in sidebar and on invoices.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize the look of your calendar and app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Calendar Theme */}
            <div className="space-y-3">
              <Label>Calendar Color Theme</Label>
              <p className="text-xs text-muted-foreground">
                Choose how bookings appear on the calendar.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.values(CALENDAR_THEMES)).map((theme) => (
                  <div
                    key={theme.id}
                    className={`rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                      calendarTheme === theme.id
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:border-muted-foreground/20"
                    }`}
                    onClick={() => setCalendarTheme(theme.id)}
                  >
                    <div className="font-medium text-sm mb-1">{theme.label}</div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {theme.description}
                    </p>
                    <div className="flex gap-1">
                      {theme.swatches.map((color, i) => (
                        <div
                          key={i}
                          className="h-5 flex-1 rounded-sm border border-black/5"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1 mt-1.5 text-[9px] text-muted-foreground">
                      <span className="flex-1 text-center">Free</span>
                      <span className="flex-1 text-center">Mine</span>
                      <span className="flex-1 text-center">Other</span>
                      <span className="flex-1 text-center">Block</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Settings</CardTitle>
            <CardDescription>
              Configure how bookings appear to your staff.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Booker Title</Label>
              <p className="text-xs text-muted-foreground">
                What title or term do you use for users who make bookings?
              </p>
              <Select
                value={staffLabel}
                onValueChange={(v) => v && setStaffLabel(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Booker">Booker</SelectItem>
                  <SelectItem value="Therapist">Therapist</SelectItem>
                  <SelectItem value="Physician">Physician</SelectItem>
                  <SelectItem value="Doctor">Doctor</SelectItem>
                  <SelectItem value="Stylist">Stylist</SelectItem>
                  <SelectItem value="Trainer">Trainer</SelectItem>
                  <SelectItem value="Instructor">Instructor</SelectItem>
                  <SelectItem value="Executive">Executive</SelectItem>
                  <SelectItem value="Other">Other (custom)</SelectItem>
                </SelectContent>
              </Select>
              {staffLabel === "Other" && (
                <Input
                  placeholder="e.g., Consultant, Coach, Trainer"
                  value={customStaffLabel}
                  onChange={(e) => setCustomStaffLabel(e.target.value)}
                />
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>
                  Show {staffLabel === "Other" ? (customStaffLabel || "booker").toLowerCase() : staffLabel.toLowerCase()} names to others
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, {staffLabel === "Other" ? (customStaffLabel || "booker").toLowerCase() : staffLabel.toLowerCase()}s can
                  see other {staffLabel === "Other" ? (customStaffLabel || "booker").toLowerCase() : staffLabel.toLowerCase()}s&apos;
                  names on booked slots. Owners always see names.
                </p>
              </div>
              <Switch
                checked={showBookerNames}
                onCheckedChange={(checked) => {
                  setShowBookerNames(checked);
                  if (!checked) setShowBookerContact(false);
                }}
              />
            </div>

            {showBookerNames && (
              <div className="flex items-center justify-between pl-4 border-l-2 border-muted">
                <div>
                  <Label>Also show contact number</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Display the contact number alongside the name on booked slots.
                  </p>
                </div>
                <Switch
                  checked={showBookerContact}
                  onCheckedChange={setShowBookerContact}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invoicing</CardTitle>
                <CardDescription>
                  Configure when and how invoices are generated.
                </CardDescription>
              </div>
              <Switch
                checked={invoicesEnabled}
                onCheckedChange={setInvoicesEnabled}
              />
            </div>
          </CardHeader>
          {invoicesEnabled && (
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Generation Mode</Label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="invoiceMode"
                      value="auto"
                      checked={invoiceMode === "auto"}
                      onChange={() => setInvoiceMode("auto")}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-medium">Automatic</div>
                      <div className="text-xs text-muted-foreground">
                        Invoices are generated automatically on the day below, each month.
                      </div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="invoiceMode"
                      value="manual"
                      checked={invoiceMode === "manual"}
                      onChange={() => setInvoiceMode("manual")}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-medium">Manual</div>
                      <div className="text-xs text-muted-foreground">
                        Invoices are only generated when you click Generate / Regenerate on the Invoices page.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceDay">
                  Invoice Day of Month (1-28)
                </Label>
                <Input
                  id="invoiceDay"
                  type="number"
                  min="1"
                  max="28"
                  value={invoiceDayOfMonth}
                  onChange={(e) => setInvoiceDayOfMonth(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const d = parseInt(invoiceDayOfMonth);
                    const startDay = d + 1 > 28 ? 1 : d + 1;
                    const startMonth = d + 1 > 28 ? "current" : "previous";
                    return `Billing period: ${startDay}${startDay === 1 ? "st" : startDay === 2 ? "nd" : startDay === 3 ? "rd" : "th"} of ${startMonth} month → ${d}${d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"} of current month.${invoiceMode === "manual" ? " Manual runs may be triggered any time on or after this day." : ""}`;
                  })()}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                <Input
                  id="invoicePrefix"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  placeholder="INV"
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Tax Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Settings</CardTitle>
            <CardDescription>
              VAT registration and rate configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT Number</Label>
                <Input
                  id="vatNumber"
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="e.g., 4123456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatRate">VAT Rate (%)</Label>
                <Input
                  id="vatRate"
                  type="number"
                  step="0.1"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Banking Details */}
        <Card>
          <CardHeader>
            <CardTitle>Banking Details</CardTitle>
            <CardDescription>
              These appear on your invoices for payments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., FNB"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type</Label>
                <Input
                  id="accountType"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  placeholder="e.g., Cheque"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branchCode">Branch Code</Label>
                <Input
                  id="branchCode"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Settings"}
        </Button>
      </form>

      {/* White Label */}
      <WhiteLabelSection orgId={convexOrg?._id} />
    </div>
  );
}

function WhiteLabelSection({ orgId }: { orgId?: any }) {
  const domains = useQuery(
    api.domains.listByOrg,
    orgId ? { orgId } : "skip"
  );
  const addDomain = useMutation(api.domains.add);
  const markVerified = useMutation(api.domains.markVerified);
  const removeDomain = useMutation(api.domains.remove);

  const [newDomain, setNewDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!orgId || !newDomain.trim()) return;
    setIsAdding(true);
    try {
      await addDomain({ orgId, domain: newDomain.trim().toLowerCase() });
      setNewDomain("");
      toast.success("Domain added! Follow the DNS instructions below.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add domain");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleVerify(domainId: string, domain: string) {
    setVerifyingId(domainId);
    try {
      const res = await fetch("/api/domains/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();

      if (data.verified) {
        await markVerified({ id: domainId as any });
        toast.success("DNS verified! Provisioning SSL certificate…", {
          description:
            "This can take up to 30 minutes. You may briefly see a 'Not secure' warning in the browser while the certificate is being issued.",
          duration: 10000,
        });
        const provRes = await fetch("/api/domains/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        });
        const provData = await provRes.json();
        if (provData.success) {
          toast.success(`${domain} is live with SSL!`);
        } else {
          toast.info(
            "SSL provisioning is still in progress. The domain will work on HTTP in the meantime and on HTTPS once the certificate is issued (typically within 30 minutes).",
            { duration: 10000 }
          );
        }
      } else {
        toast.error(data.message || "DNS not verified yet");
      }
    } catch (error) {
      toast.error("Failed to verify domain");
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleRemove(domainId: string, domain: string) {
    try {
      await removeDomain({ id: domainId as any });
      // Remove from Nginx
      await fetch("/api/domains/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, action: "remove" }),
      });
      toast.success("Domain removed");
    } catch (error) {
      toast.error("Failed to remove domain");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>White Label</CardTitle>
        <CardDescription>
          Add a custom subdomain so your users see your branding instead of
          RoomBook.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add domain */}
        <div className="flex gap-2">
          <Input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g., room.yourpractice.co.za"
            className="flex-1"
          />
          <Button
            onClick={handleAdd}
            disabled={isAdding || !newDomain.trim()}
          >
            {isAdding ? "Adding..." : "Add Domain"}
          </Button>
        </div>

        {/* Existing domains */}
        {domains && domains.length > 0 && (
          <div className="space-y-3">
            {domains.map((d) => (
              <div
                key={d._id}
                className="rounded-lg border p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{d.domain}</span>
                    <Badge
                      variant={d.isVerified ? "default" : "secondary"}
                    >
                      {d.isVerified ? "Verified" : "Pending"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {!d.isVerified && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={verifyingId === d._id}
                        onClick={() => handleVerify(d._id, d.domain)}
                      >
                        {verifyingId === d._id ? "Checking..." : "Verify DNS"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleRemove(d._id, d.domain)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                {!d.isVerified && (
                  <div id="domains-unverified" className="rounded bg-muted p-3 text-xs space-y-2">
                    <p className="font-medium">DNS Setup Instructions</p>
                    <p>
                      Ask your hosting provider or IT Admin to add the below
                      record as a DNS entry for the domain you own, or use
                      your hosting cPanel / KonsoleH / Admin Panel to add it
                      yourself.
                    </p>
                    <div className="font-mono bg-background rounded p-2 border">
                      <p>Type: CNAME</p>
                      <p>
                        Name:{" "}
                        {d.domain.split(".").length > 2
                          ? d.domain.split(".")[0]
                          : d.domain}
                      </p>
                      <p>Value: roombook.co.za</p>
                    </div>
                    <p className="text-muted-foreground">
                      Once it&apos;s added, click <strong>Verify DNS</strong>{" "}
                      to verify. Your white-label link will not work until
                      your DNS record is verified.
                    </p>
                    <p className="text-muted-foreground">
                      After DNS is verified, an SSL certificate is issued
                      automatically. This can take up to <strong>30 minutes</strong>
                      {" "}— you may briefly see a &quot;Not secure&quot;
                      warning in the browser while the certificate is being
                      provisioned.
                    </p>
                  </div>
                )}

                {d.isVerified && (
                  <p className="text-xs text-muted-foreground">
                    Live at{" "}
                    <a
                      href={`https://${d.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      https://{d.domain}
                    </a>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
