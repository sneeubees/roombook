"use client";

/**
 * Subscription tiers are disabled for now. Every user sees every feature
 * their role permits. This hook is kept so existing call sites continue to
 * compile; `can(...)` always returns true.
 */
export function useSubscriptionTier() {
  return {
    tier: "enterprise" as const,
    can: (_feature: string) => true,
    isBasic: false,
    isProfessional: false,
    isEnterprise: true,
  };
}
