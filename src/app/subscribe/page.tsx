"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { TIERS, formatZAR, type SubscriptionTier } from "@/lib/tiers";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

export default function SubscribePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.currentUser);
  const orgData = useQuery(api.organizations.currentOrg);
  const requestSubscription = useMutation(
    api.organizations.requestSubscription
  );

  const initialTier = (searchParams.get("tier") as SubscriptionTier) ?? "professional";
  const [selected, setSelected] = useState<SubscriptionTier>(
    initialTier in TIERS ? initialTier : "professional"
  );
  const [step, setStep] = useState<"plan" | "checkout" | "submitted">("plan");
  const [notes, setNotes] = useState("");
  const [reference, setReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Generate a payment reference once we know the org name + tier
  useEffect(() => {
    if (step === "checkout" && !reference && orgData?.org) {
      const slug = orgData.org.slug.toUpperCase().slice(0, 10).replace(/-/g, "");
      const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
      setReference(`RB-${slug}-${stamp}`);
    }
  }, [step, reference, orgData]);

  // Skip the "sign up first" middle step — push unauthenticated visitors
  // straight to the sign-up page, preserving the tier they picked.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/sign-up?tier=${selected}`);
    }
  }, [isLoading, isAuthenticated, router, selected]);

  if (!isLoading && !isAuthenticated) {
    return null;
  }

  const tier = TIERS[selected];

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/" className="text-sm text-muted-foreground underline">
          &larr; Back to home
        </Link>

        {step === "plan" && (
          <Card>
            <CardHeader>
              <CardTitle>Choose your plan</CardTitle>
              <CardDescription>
                Pick a tier. You can upgrade or downgrade later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {(["basic", "professional", "enterprise"] as const).map((tierId) => {
                  const t = TIERS[tierId];
                  const isSelected = selected === tierId;
                  return (
                    <button
                      key={tierId}
                      type="button"
                      onClick={() => setSelected(tierId)}
                      className={
                        "text-left rounded-lg border p-4 transition-colors " +
                        (isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/40")
                      }
                    >
                      <div className="font-bold">{t.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.tagline}
                      </div>
                      <div className="mt-2">
                        <span className="text-2xl font-bold">
                          {formatZAR(t.monthlyPriceZAR)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {" "}/ month
                        </span>
                      </div>
                      <ul className="mt-3 space-y-1 text-xs">
                        {t.highlights.slice(0, 4).map((h) => (
                          <li key={h} className="flex items-start gap-1.5">
                            <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                            <span>{h}</span>
                          </li>
                        ))}
                        {t.notIncluded.map((h) => (
                          <li
                            key={h}
                            className="flex items-start gap-1.5 text-muted-foreground"
                          >
                            <X className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={() => setStep("checkout")}>
                  Continue to checkout
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "checkout" && (
          <Card>
            <CardHeader>
              <CardTitle>Checkout</CardTitle>
              <CardDescription>
                Pay via EFT using the details below. Your account is activated
                once we confirm payment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Cart summary */}
              <div className="rounded-md border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{tier.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {tier.description}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {formatZAR(tier.monthlyPriceZAR)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      per month
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs underline text-muted-foreground"
                  onClick={() => setStep("plan")}
                >
                  Change plan
                </button>
              </div>

              {/* Account details */}
              <div className="rounded-md bg-muted/50 border p-4 text-sm space-y-1">
                <p className="font-medium mb-1">Account holder</p>
                <p>{me?.fullName ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{me?.email}</p>
                {orgData?.org && (
                  <p className="text-xs">
                    Organisation:{" "}
                    <strong>{orgData.org.name}</strong>
                  </p>
                )}
              </div>

              {/* EFT instructions */}
              <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-4 space-y-2 text-sm">
                <p className="font-semibold">EFT — Bank transfer</p>
                <p className="text-xs text-muted-foreground">
                  Pay the amount shown into the account below using the
                  reference. Your subscription activates as soon as we verify
                  the payment (usually within one business day).
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  <div>Bank</div>
                  <div className="font-mono">FNB</div>
                  <div>Account name</div>
                  <div className="font-mono">RoomBook (Pty) Ltd</div>
                  <div>Account number</div>
                  <div className="font-mono">62812345678</div>
                  <div>Branch code</div>
                  <div className="font-mono">250655</div>
                  <div>Amount</div>
                  <div className="font-mono">
                    {formatZAR(tier.monthlyPriceZAR)}
                  </div>
                  <div>Reference</div>
                  <div className="font-mono font-bold">{reference}</div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Anything we should know? (optional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., expected payment date, special requests"
                  rows={3}
                />
              </div>

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep("plan")}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={async () => {
                    if (!orgData?.org) {
                      toast.error("No organisation found for your account");
                      return;
                    }
                    setIsSubmitting(true);
                    try {
                      await requestSubscription({
                        orgId: orgData.org._id,
                        tier: selected,
                        paymentReference: reference,
                        notes: notes || undefined,
                      });
                      setStep("submitted");
                    } catch (err) {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Failed to submit subscription request"
                      );
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  {isSubmitting ? "Submitting…" : "Submit subscription request"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "submitted" && (
          <Card>
            <CardHeader>
              <CardTitle>Subscription request received</CardTitle>
              <CardDescription>
                We&apos;ll activate your account as soon as the EFT clears.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Use reference <strong className="font-mono">{reference}</strong>{" "}
                when making the payment.
              </p>
              <p className="text-muted-foreground">
                You can sign in any time. Your subscription will be visible once
                payment is verified.
              </p>
              <div className="pt-3 flex gap-2">
                <Link href="/" className={buttonVariants({ variant: "outline" })}>
                  Back to home
                </Link>
                <Link href="/dashboard" className={buttonVariants()}>
                  Go to dashboard
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
