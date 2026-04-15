"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { useUser, SignUp } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { user, isSignedIn } = useUser();
  const invitation = useQuery(api.invitations.getByToken, { token });
  const acceptInvitation = useMutation(api.invitations.accept);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (isSignedIn && invitation && invitation.status === "pending" && !accepted) {
      acceptInvitation({ token })
        .then(() => {
          setAccepted(true);
          router.push("/dashboard");
        })
        .catch(console.error);
    }
  }, [isSignedIn, invitation, token, acceptInvitation, accepted, router]);

  if (invitation === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading invitation...</p>
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
          <CardTitle>Invitation Expired</CardTitle>
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

  if (isSignedIn) {
    return (
      <Card className="max-w-md mx-auto mt-20">
        <CardHeader>
          <CardTitle>Joining organization...</CardTitle>
          <CardDescription>
            Please wait while we add you to the organization.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle>You&apos;ve been invited!</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as a{" "}
            <Badge variant="secondary">{invitation.role}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Create your account to get started.
          </p>
        </CardContent>
      </Card>
      <SignUp
        forceRedirectUrl={`/invite/${token}`}
        initialValues={{ emailAddress: invitation.email }}
      />
    </div>
  );
}
