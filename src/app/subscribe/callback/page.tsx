"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

type State = "checking" | "success" | "pending" | "error";

const COPY: Record<State, { title: string; description: string }> = {
  checking: {
    title: "Verifying your payment…",
    description: "One moment while we confirm your subscription.",
  },
  success: {
    title: "Payment successful",
    description: "Your subscription is now active. Welcome aboard!",
  },
  pending: {
    title: "Payment received",
    description:
      "Your payment is processing. Your subscription activates automatically as soon as it clears — no need to pay again.",
  },
  error: {
    title: "We couldn't verify this payment",
    description:
      "If you were charged, your subscription will still activate automatically once the payment confirms. Contact support if anything looks wrong.",
  },
};

function CallbackInner() {
  const searchParams = useSearchParams();
  const verify = useAction(api.paystack.verifyTransaction);
  const reference =
    searchParams.get("reference") ?? searchParams.get("trxref") ?? "";
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;
    if (!reference) {
      setState("error");
      return;
    }
    verify({ reference })
      .then((r) => {
        if (!cancelled) setState(r.status === "success" ? "success" : "pending");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reference, verify]);

  const copy = COPY[state];

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-6 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard" className={buttonVariants()}>
            Go to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SubscribeCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
