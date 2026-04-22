"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DoorOpen } from "lucide-react";
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
import { toast } from "sonner";

export default function SignUpPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierParam = searchParams.get("tier");
  const tierQuery = tierParam ? `?tier=${tierParam}` : "";

  const [step, setStep] = useState<"details" | "verify">("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmitDetails(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setIsSubmitting(true);
    try {
      await signIn("password", {
        email,
        password,
        name: fullName,
        flow: "signUp",
      });
      toast.success("Check your email for the verification code.");
      setStep("verify");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signIn("password", {
        email,
        code,
        flow: "email-verification",
      });
      router.push(`/onboarding${tierQuery}`);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message.includes("Invalid")
            ? "That code didn't work. Check your email and try again."
            : err.message
          : "Verification failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    if (!email) return;
    setIsSubmitting(true);
    try {
      await signIn("resend-otp", { email });
      toast.success("A new code is on its way.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-6">
      <Link href="/" className="flex items-center gap-2">
        <DoorOpen className="h-7 w-7 text-primary" />
        <span className="text-2xl font-bold">RoomBook</span>
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          {step === "details" ? (
            <>
              <CardTitle>Create your account</CardTitle>
              <CardDescription>
                Start managing room bookings for your practice.
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle>Verify your email</CardTitle>
              <CardDescription>
                We&apos;ve sent a 6-digit code to <strong>{email}</strong>.
                Enter it below to continue.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {step === "details" ? (
            <form onSubmit={onSubmitDetails} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "Creating account…" : "Create account"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <Link href="/sign-in" className="underline">
                  Sign in
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={onSubmitCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  required
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="tracking-widest text-center font-mono"
                />
              </div>
              <Button
                type="submit"
                disabled={isSubmitting || code.length < 6}
                className="w-full"
              >
                {isSubmitting ? "Verifying…" : "Verify and continue"}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-muted-foreground underline"
                  onClick={() => setStep("details")}
                >
                  Change email
                </button>
                <button
                  type="button"
                  className="underline"
                  onClick={resendCode}
                  disabled={isSubmitting}
                >
                  Resend code
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
