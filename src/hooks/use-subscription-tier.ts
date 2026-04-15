"use client";

import { useOrgData } from "./use-org-data";
import { hasFeature, type Feature, type SubscriptionTier } from "@/lib/tiers";

export function useSubscriptionTier() {
  const { convexOrg } = useOrgData();
  const tier: SubscriptionTier =
    (convexOrg?.subscriptionTier as SubscriptionTier) ?? "basic";

  return {
    tier,
    can: (feature: Feature) => hasFeature(tier, feature),
    isBasic: tier === "basic",
    isProfessional: tier === "professional",
    isEnterprise: tier === "enterprise",
  };
}
