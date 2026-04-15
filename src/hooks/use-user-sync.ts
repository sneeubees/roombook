"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef } from "react";

/**
 * Syncs the current Clerk user to the Convex users table.
 * Call this once in the dashboard layout.
 */
export function useUserSync() {
  const { user, isSignedIn } = useUser();
  const upsertUser = useMutation(api.users.upsert);
  const synced = useRef(false);

  useEffect(() => {
    if (isSignedIn && user && !synced.current) {
      synced.current = true;
      upsertUser({
        clerkUserId: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        fullName: user.fullName ?? "",
        phone: user.primaryPhoneNumber?.phoneNumber,
        imageUrl: user.imageUrl,
      }).catch(console.error);
    }
  }, [isSignedIn, user, upsertUser]);
}
