"use client";

import { useOrgData } from "./use-org-data";
import {
  hasFeature,
  maxRooms,
  TIERS,
  type Feature,
  type SubscriptionTier,
} from "@/lib/tiers";

export function useSubscriptionTier() {
  const { convexOrg } = useOrgData();
  const tier: SubscriptionTier =
    (convexOrg?.subscriptionTier as SubscriptionTier) ?? "basic";

  return {
    tier,
    config: TIERS[tier],
    can: (feature: Feature | string) =>
      hasFeature(tier, feature as Feature),
    maxRooms: maxRooms(tier),
    isBasic: tier === "basic",
    isProfessional: tier === "professional",
    isEnterprise: tier === "enterprise",
  };
}
