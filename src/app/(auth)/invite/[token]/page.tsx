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
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Once signed in with a valid pending invite, auto-accept it.
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
      } else {
        await signIn("password", {
          email: invitation!.email,
          password,
          flow: "signIn",
        });
      }
      // useEffect will handle accepting the invitation after auth state updates.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 space-y-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>You&apos;ve been invited!</CardTitle>
          <CardDescription>
            Join as a <Badge variant="secondary">{invitation.role}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={invitation.email} disabled />
            </div>
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
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting
                ? "Working…"
                : mode === "signup"
                  ? "Create account & accept"
                  : "Sign in & accept"}
            </Button>
          </form>
        </CardContent>
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
      </Card>
      <div className="text-center text-xs text-muted-foreground">
        <Link href="/sign-in" className="underline">
          Cancel
        </Link>
      </div>
    </div>
  );
}
