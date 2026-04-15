export type SubscriptionTier = "basic" | "professional" | "enterprise";

export const TIER_FEATURES = {
  basic: {
    label: "Basic",
    description: "Booking and calendar only",
    features: ["calendar", "booking", "rooms"],
  },
  professional: {
    label: "Professional",
    description: "Full booking platform with reporting and invoicing",
    features: [
      "calendar",
      "booking",
      "rooms",
      "history",
      "reports",
      "invoices",
    ],
  },
  enterprise: {
    label: "Enterprise",
    description: "Everything in Professional plus white-labeling",
    features: [
      "calendar",
      "booking",
      "rooms",
      "history",
      "reports",
      "invoices",
      "whitelabel",
    ],
  },
} as const;

export type Feature =
  | "calendar"
  | "booking"
  | "rooms"
  | "history"
  | "reports"
  | "invoices"
  | "whitelabel";

export function hasFeature(tier: SubscriptionTier, feature: Feature): boolean {
  return (TIER_FEATURES[tier].features as readonly string[]).includes(feature);
}
