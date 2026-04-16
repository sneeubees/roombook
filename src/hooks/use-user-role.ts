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
  const isOwnerRole = role === "org:admin";
  const isManagerRole = role === "org:manager";
  const isBookerRole = role === "org:member";

  return {
    // Owner = actual owner OR super admin (super admin gets owner-like access)
    isOwner: isOwnerRole || isSuperAdmin,
    isManager: isManagerRole,
    isBooker: isBookerRole,
    isSuperAdmin,
    // Can manage bookings, rooms, team — owner or manager
    canManage: isOwnerRole || isManagerRole || isSuperAdmin,
    // Settings and Reports — owner only (not manager)
    canAccessSettings: isOwnerRole || isSuperAdmin,
    canAccessReports: isOwnerRole || isSuperAdmin,
    role,
  };
}
