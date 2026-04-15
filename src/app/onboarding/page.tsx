"use client";

import { useOrganizationList, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { DoorOpen } from "lucide-react";

export default function OnboardingPage() {
  const { createOrganization, setActive, userMemberships } =
    useOrganizationList({ userMemberships: { pageSize: 1 } });
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const creating = useRef(false);

  useEffect(() => {
    if (!isSignedIn) {
      router.push("/sign-in");
      return;
    }

    // If user already has an org, just go to dashboard
    if (userMemberships?.data && userMemberships.data.length > 0) {
      const firstOrg = userMemberships.data[0].organization;
      if (setActive) {
        setActive({ organization: firstOrg.id }).then(() => {
          router.push("/dashboard");
        });
      }
      return;
    }

    // Auto-create org with user's name
    if (
      createOrganization &&
      setActive &&
      user &&
      userMemberships?.data?.length === 0 &&
      !creating.current
    ) {
      creating.current = true;
      const name = user.fullName
        ? `${user.fullName}'s Practice`
        : "My Practice";

      createOrganization({ name })
        .then((org) => setActive({ organization: org.id }))
        .then(() => router.push("/dashboard"))
        .catch((err) => {
          console.error("Failed to create organization:", err);
          creating.current = false;
        });
    }
  }, [isSignedIn, user, createOrganization, setActive, userMemberships, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center space-y-4">
        <DoorOpen className="h-12 w-12 text-primary mx-auto animate-pulse" />
        <p className="text-muted-foreground">Setting up your workspace...</p>
      </div>
    </div>
  );
}
