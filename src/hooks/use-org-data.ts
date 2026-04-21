"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Returns the current user's primary organisation (the first one they are a
 * member of, preferring an Owner membership). If they have no org, the caller
 * should redirect to /onboarding where they create one.
 */
export function useOrgData() {
  const data = useQuery(api.organizations.currentOrg);
  const isLoaded = data !== undefined;
  const org = data?.org ?? null;
  const membership = data?.membership ?? null;
  return {
    convexOrg: org,
    membership,
    isLoaded,
    orgId: org?._id,
    role: membership?.role,
  };
}
