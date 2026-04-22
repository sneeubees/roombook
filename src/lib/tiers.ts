export type SubscriptionTier = "basic" | "professional" | "enterprise";

export type Feature =
  | "calendar"
  | "booking"
  | "history"
  | "reports"
  | "multipleRooms"
  | "invoicing"
  | "whitelabel";

export interface TierConfig {
  id: SubscriptionTier;
  label: string;
  tagline: string;
  monthlyPriceZAR: number; // in cents
  description: string;
  features: readonly Feature[];
  maxRooms: number; // 0 = unlimited
  highlights: readonly string[];
  notIncluded: readonly string[];
}

export const TIERS: Record<SubscriptionTier, TierConfig> = {
  basic: {
    id: "basic",
    label: "Starter",
    tagline: "For a single room",
    monthlyPriceZAR: 14900, // R 149 / month
    description: "Bookings, calendar and team — limited to one room.",
    features: ["calendar", "booking"],
    maxRooms: 1,
    highlights: [
      "1 room",
      "Calendar bookings",
      "Team members",
      "Booking history",
    ],
    notIncluded: ["Multiple rooms", "Invoicing", "White-label domain"],
  },
  professional: {
    id: "professional",
    label: "Professional",
    tagline: "For growing practices",
    monthlyPriceZAR: 39900, // R 399 / month
    description: "Unlimited rooms, full invoicing, reports — no white-label.",
    features: [
      "calendar",
      "booking",
      "history",
      "reports",
      "multipleRooms",
      "invoicing",
    ],
    maxRooms: 0,
    highlights: [
      "Unlimited rooms",
      "Automated monthly invoicing",
      "Reports and exports",
      "Booking history",
    ],
    notIncluded: ["White-label domain"],
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    tagline: "Run on your own domain",
    monthlyPriceZAR: 79900, // R 799 / month
    description:
      "Everything in Professional plus your own white-label domain.",
    features: [
      "calendar",
      "booking",
      "history",
      "reports",
      "multipleRooms",
      "invoicing",
      "whitelabel",
    ],
    maxRooms: 0,
    highlights: [
      "Everything in Professional",
      "White-label domain (e.g. bookings.yourpractice.co.za)",
      "Custom logo on your tenants' calendar",
      "Priority support",
    ],
    notIncluded: [],
  },
};

// Backwards-compat helpers used in the rest of the codebase.
export const TIER_FEATURES = TIERS;

export function hasFeature(
  tier: SubscriptionTier | undefined,
  feature: Feature
): boolean {
  const t = tier ?? "basic";
  return (TIERS[t].features as readonly Feature[]).includes(feature);
}

export function maxRooms(tier: SubscriptionTier | undefined): number {
  const t = tier ?? "basic";
  return TIERS[t].maxRooms;
}

export function formatZAR(cents: number): string {
  return `R ${(cents / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
