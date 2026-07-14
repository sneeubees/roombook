import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireSuperAdmin } from "./authz";

// Defaults seed the singleton on first read; they mirror src/lib/tiers.ts.
// Once a super admin edits via /admin/pricing, those values win.
const DEFAULTS = {
  basicMonthlyCents: 14900,
  professionalMonthlyCents: 39900,
  enterpriseMonthlyCents: 79900,
};

function summarise(row: Doc<"pricingConfig">) {
  return {
    basicMonthlyCents: row.basicMonthlyCents,
    professionalMonthlyCents: row.professionalMonthlyCents,
    enterpriseMonthlyCents: row.enterpriseMonthlyCents,
    basicPlanCode: row.basicPlanCode ?? null,
    professionalPlanCode: row.professionalPlanCode ?? null,
    enterprisePlanCode: row.enterprisePlanCode ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

// Synthesised when no row exists yet — plan codes fall back to env.
function defaultSummary() {
  return {
    basicMonthlyCents: DEFAULTS.basicMonthlyCents,
    professionalMonthlyCents: DEFAULTS.professionalMonthlyCents,
    enterpriseMonthlyCents: DEFAULTS.enterpriseMonthlyCents,
    basicPlanCode: process.env.PAYSTACK_PLAN_BASIC?.trim() ?? null,
    professionalPlanCode: process.env.PAYSTACK_PLAN_PROFESSIONAL?.trim() ?? null,
    enterprisePlanCode: process.env.PAYSTACK_PLAN_ENTERPRISE?.trim() ?? null,
    updatedAt: null as number | null,
  };
}

// Public — homepage / subscribe page read current pricing.
export const current = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("pricingConfig")
      .withIndex("by_singleton", (q) => q.eq("singleton", "only"))
      .unique();
    return row ? summarise(row) : defaultSummary();
  },
});

// Internal — used by paystack.startCheckout (no auth-context noise).
export const currentInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("pricingConfig")
      .withIndex("by_singleton", (q) => q.eq("singleton", "only"))
      .unique();
    return row ? summarise(row) : defaultSummary();
  },
});

async function getOrCreateRow(ctx: MutationCtx): Promise<Doc<"pricingConfig">> {
  const existing = await ctx.db
    .query("pricingConfig")
    .withIndex("by_singleton", (q) => q.eq("singleton", "only"))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("pricingConfig", {
    singleton: "only",
    basicMonthlyCents: DEFAULTS.basicMonthlyCents,
    professionalMonthlyCents: DEFAULTS.professionalMonthlyCents,
    enterpriseMonthlyCents: DEFAULTS.enterpriseMonthlyCents,
    basicPlanCode: process.env.PAYSTACK_PLAN_BASIC?.trim(),
    professionalPlanCode: process.env.PAYSTACK_PLAN_PROFESSIONAL?.trim(),
    enterprisePlanCode: process.env.PAYSTACK_PLAN_ENTERPRISE?.trim(),
    updatedAt: Date.now(),
  });
  const row = await ctx.db.get(id);
  if (!row) throw new ConvexError("pricingConfig insert race");
  return row;
}

// Super admin — update tier prices and/or plan codes. Changing a tier's price
// does NOT change existing Paystack subscribers (plan amounts are immutable);
// use createTierPlan to mint a fresh plan for the new price.
export const updatePricing = mutation({
  args: {
    basicMonthlyCents: v.optional(v.number()),
    professionalMonthlyCents: v.optional(v.number()),
    enterpriseMonthlyCents: v.optional(v.number()),
    basicPlanCode: v.optional(v.string()),
    professionalPlanCode: v.optional(v.string()),
    enterprisePlanCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireSuperAdmin(ctx);
    const row = await getOrCreateRow(ctx);

    const patch: Partial<Doc<"pricingConfig">> = {
      updatedAt: Date.now(),
      updatedByUserId: userId,
    };
    for (const tier of ["basic", "professional", "enterprise"] as const) {
      const centsKey = `${tier}MonthlyCents` as const;
      const cents = args[centsKey];
      if (cents !== undefined) {
        if (cents <= 0) throw new ConvexError(`${tier} price must be positive`);
        patch[centsKey] = cents;
      }
      const codeKey = `${tier}PlanCode` as const;
      const code = args[codeKey];
      if (code !== undefined) patch[codeKey] = code.trim() || undefined;
    }

    await ctx.db.patch(row._id, patch);
    return summarise({ ...row, ...patch } as Doc<"pricingConfig">);
  },
});

// Internal — write back a plan code after minting a plan on Paystack.
export const setPlanCode = internalMutation({
  args: {
    tier: v.union(
      v.literal("basic"),
      v.literal("professional"),
      v.literal("enterprise")
    ),
    planCode: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await getOrCreateRow(ctx);
    const field =
      args.tier === "basic"
        ? "basicPlanCode"
        : args.tier === "professional"
          ? "professionalPlanCode"
          : "enterprisePlanCode";
    await ctx.db.patch(row._id, { [field]: args.planCode, updatedAt: Date.now() });
  },
});
