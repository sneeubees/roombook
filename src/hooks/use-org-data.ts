"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef } from "react";

export function useOrgData() {
  const { organization, isLoaded } = useOrganization();
  const createOrg = useMutation(api.organizations.create);
  const creating = useRef(false);

  const convexOrg = useQuery(
    api.organizations.getByClerkOrgId,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  // Auto-sync: if Clerk org exists but Convex org doesn't, create it
  useEffect(() => {
    if (organization && convexOrg === null && !creating.current) {
      creating.current = true;
      createOrg({
        clerkOrgId: organization.id,
        name: organization.name,
        slug: organization.slug ?? organization.name.toLowerCase().replace(/\s+/g, "-"),
      })
        .catch(console.error)
        .finally(() => {
          creating.current = false;
        });
    }
  }, [organization, convexOrg, createOrg]);

  return {
    clerkOrg: organization,
    convexOrg,
    isLoaded,
    orgId: convexOrg?._id,
  };
}
