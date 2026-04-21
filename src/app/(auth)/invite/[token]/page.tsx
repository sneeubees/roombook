"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const invitation = useQuery(api.invitations.getByToken, { token });
  const acceptInvitation = useMutation(api.invitations.accept);
  const [accepting, setAccepting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"signup" | "signin" | "verify">("signup");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      invitation &&
      invitation.status === "pending" &&
      !accepting
    ) {
      setAccepting(true);
      acceptInvitation({ token })
        .then(() => router.push("/dashboard"))
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Failed to accept invitation");
          setAccepting(false);
        });
    }
  }, [isLoading, isAuthenticated, invitation, token, acceptInvitation, accepting, router]);

  if (invitation === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading invitation…</p>
      </div>
    );
  }

  if (!invitation) {
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader>
          <CardTitle>Invalid Invitation</CardTitle>
          <CardDescription>
            This invitation link is not valid or has already been used.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (invitation.status !== "pending") {
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader>
          <CardTitle>Invitation Already {invitation.status}</CardTitle>
          <CardDescription>
            This invitation has already been{" "}
            {invitation.status === "accepted" ? "accepted" : invitation.status}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (Date.now() > invitation.expiresAt) {
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader>
          <CardTitle>Invitation Expired</CardTitle>
          <CardDescription>
            This invitation link has expired. Please ask for a new one.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isAuthenticated) {
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader>
          <CardTitle>Joining organisation…</CardTitle>
          <CardDescription>
            Please wait while we add you to the organisation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === "signup") {
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters");
          setIsSubmitting(false);
          return;
        }
        await signIn("password", {
          email: invitation!.email,
          password,
          name: fullName,
          flow: "signUp",
        });
        toast.success("Check your email for the verification code.");
        setMode("verify");
      } else if (mode === "verify") {
        await signIn("password", {
          email: invitation!.email,
          code,
          flow: "email-verification",
        });
        // useEffect will handle accepting the invitation.
      } else {
        await signIn("password", {
          email: invitation!.email,
          password,
          flow: "signIn",
        });
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message.includes("Invalid")
            ? "That didn't work. Check your email / code and try again."
            : err.message
          : "Failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendCode() {
    if (!invitation) return;
    setIsSubmitting(true);
    try {
      await signIn("resend-otp", { email: invitation.email });
      toast.success("A new code is on its way.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 space-y-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>
            {mode === "verify"
              ? "Verify your email"
              : "You've been invited!"}
          </CardTitle>
          <CardDescription>
            {mode === "verify" ? (
              <>
                We&apos;ve sent a 6-digit code to{" "}
                <strong>{invitation.email}</strong>.
              </>
            ) : (
              <>
                Join as a <Badge variant="secondary">{invitation.role}</Badge>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {mode !== "verify" && (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={invitation.email} disabled />
              </div>
            )}
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            {(mode === "signup" || mode === "signin") && (
              <div className="space-y-2">
                <Label htmlFor="password">
                  {mode === "signup" ? "Choose a password" : "Password"}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                />
              </div>
            )}
            {mode === "verify" && (
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
            )}
            <Button
              type="submit"
              disabled={isSubmitting || (mode === "verify" && code.length < 6)}
              className="w-full"
            >
              {isSubmitting
                ? "Working…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "verify"
                    ? "Verify & accept"
                    : "Sign in & accept"}
            </Button>
            {mode === "verify" && (
              <div className="flex items-center justify-end text-sm">
                <button
                  type="button"
                  className="underline"
                  onClick={resendCode}
                  disabled={isSubmitting}
                >
                  Resend code
                </button>
              </div>
            )}
          </form>
        </CardContent>
        {mode !== "verify" && (
          <CardFooter className="text-sm text-muted-foreground justify-center">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="underline ml-1"
                  onClick={() => setMode("signin")}
                >
                  Sign in instead
                </button>
              </>
            ) : (
              <>
                Need a new account?{" "}
                <button
                  type="button"
                  className="underline ml-1"
                  onClick={() => setMode("signup")}
                >
                  Sign up
                </button>
              </>
            )}
          </CardFooter>
        )}
      </Card>
      <div className="text-center text-xs text-muted-foreground">
        <Link href="/sign-in" className="underline">
          Cancel
        </Link>
      </div>
    </div>
  );
}
