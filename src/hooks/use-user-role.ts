"use client";

import { useOrganization, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useUserRole() {
  const { membership } = useOrganization();
  const { user } = useUser();

  const convexUser = useQuery(
    api.users.getByClerkUserId,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  const role = membership?.role;
  const isSuperAdmin = convexUser?.isSuperAdmin === true;

  return {
    isOwner: role === "org:admin" || isSuperAdmin,
    isBooker: role === "org:member",
    isSuperAdmin,
    role,
  };
}
