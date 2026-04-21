"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useUserRole() {
  const me = useQuery(api.users.currentUser);
  const org = useQuery(api.organizations.currentOrg);

  const role = org?.membership?.role ?? null;
  const isSuperAdmin = me?.isSuperAdmin === true;
  const isOwnerRole = role === "owner";
  const isManagerRole = role === "manager";
  const isBookerRole = role === "booker";

  return {
    isOwner: isOwnerRole || isSuperAdmin,
    isManager: isManagerRole,
    isBooker: isBookerRole,
    isSuperAdmin,
    canManage: isOwnerRole || isManagerRole || isSuperAdmin,
    canAccessSettings: isOwnerRole || isSuperAdmin,
    canAccessReports: isOwnerRole || isSuperAdmin,
    role,
  };
}
