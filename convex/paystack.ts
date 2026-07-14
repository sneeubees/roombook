import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import * as paystack from "./lib/paystack";

const tierValidator = v.union(
  v.literal("basic"),
  v.literal("professional"),
  v.literal("enterprise")
);

// Begin a card subscription. Owner-only. Amount/plan are resolved server-side
// from the tier — never trusted from the client. Returns the Paystack-hosted
// checkout URL for the client to redirect to. Activation is authoritative via
// the webhook, not the post-payment redirect.
export const startCheckout = action({
  args: { orgId: v.id("organizations"), tier: tierValidator },
  handler: async (ctx, args): Promise<{ authorizationUrl: string }> => {
    await ctx.runQuery(internal.authz.assertOrgAccess, {
      orgId: args.orgId,
      level: "owner",
    });

    const info = await ctx.runQuery(internal.paystackInternal.getCheckoutInfo, {
      orgId: args.orgId,
    });
    if (!info) throw new Error("No billing email found for this organisation");

    const pricing = await ctx.runQuery(internal.pricing.currentInternal, {});
    const planCode =
      args.tier === "basic"
        ? pricing.basicPlanCode
        : args.tier === "professional"
          ? pricing.professionalPlanCode
          : pricing.enterprisePlanCode;
    if (!planCode) {
      throw new Error(
        `No Paystack plan configured for the ${args.tier} tier. A super admin can create one at /admin/pricing.`
      );
    }

    let customerCode = info.paystackCustomerCode;
    if (!customerCode) {
      const customer = await paystack.getOrCreateCustomer({
        email: info.email,
        firstName: info.name,
      });
      customerCode = customer.customer_code;
      await ctx.runMutation(internal.paystackInternal.setCustomerCode, {
        orgId: args.orgId,
        customerCode,
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://roombook.co.za";
    const reference = `RB-${args.orgId}-${Date.now()}`;

    const tx = await paystack.initializeTransaction({
      email: info.email,
      planCode,
      reference,
      callbackUrl: `${appUrl}/subscribe/callback`,
      metadata: { platform: "roombook", orgId: args.orgId, tier: args.tier },
    });

    return { authorizationUrl: tx.authorization_url };
  },
});

// Post-payment UX only — reports the transaction status to the callback page.
// The org is activated by the webhook regardless of this call.
export const verifyTransaction = action({
  args: { reference: v.string() },
  handler: async (_ctx, args): Promise<{ status: string }> => {
    const result = await paystack.verifyTransaction(args.reference);
    return { status: result.status };
  },
});

export const cancelSubscription = action({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    await ctx.runQuery(internal.authz.assertOrgAccess, {
      orgId: args.orgId,
      level: "owner",
    });
    const info = await ctx.runQuery(
      internal.paystackInternal.getSubscriptionInfo,
      { orgId: args.orgId }
    );
    if (!info?.subscriptionCode || !info.emailToken) {
      throw new Error("No active Paystack subscription to cancel");
    }
    await paystack.disableSubscription({
      code: info.subscriptionCode,
      token: info.emailToken,
    });
    await ctx.runMutation(internal.paystackInternal.markNonRenewing, {
      orgId: args.orgId,
    });
    return { ok: true };
  },
});

export const getManageLink = action({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args): Promise<{ link: string }> => {
    await ctx.runQuery(internal.authz.assertOrgAccess, {
      orgId: args.orgId,
      level: "owner",
    });
    const info = await ctx.runQuery(
      internal.paystackInternal.getSubscriptionInfo,
      { orgId: args.orgId }
    );
    if (!info?.subscriptionCode) throw new Error("No subscription found");
    const { link } = await paystack.subscriptionManageLink(info.subscriptionCode);
    return { link };
  },
});

// One-time provisioning: creates the three monthly ZAR plans in the shared
// Paystack account. Run from the Convex dashboard "Run function" UI, then put
// the returned PLN_ codes into the PAYSTACK_PLAN_* env vars. Amounts mirror
// src/lib/tiers.ts (cents).
export const provisionPlans = internalAction({
  args: {},
  handler: async (): Promise<Record<string, string>> => {
    const plans = [
      { tier: "basic", name: "RoomBook Starter", amount: 14900 },
      { tier: "professional", name: "RoomBook Professional", amount: 39900 },
      { tier: "enterprise", name: "RoomBook Enterprise", amount: 79900 },
    ];
    const result: Record<string, string> = {};
    for (const plan of plans) {
      const { plan_code } = await paystack.createPlan({
        name: plan.name,
        amount: plan.amount,
      });
      result[plan.tier] = plan_code;
    }
    return result;
  },
});

// Super admin — mint a fresh Paystack plan for a tier at the given amount and
// store its code. Powers the "recreate package" buttons on /admin/pricing.
// Paystack plan amounts are immutable, so changing a tier's price needs a new
// plan; existing subscribers keep their old plan until they resubscribe.
export const createTierPlan = action({
  args: { tier: tierValidator, amountCents: v.number() },
  handler: async (ctx, args): Promise<{ ok: true; planCode: string }> => {
    await ctx.runQuery(internal.authz.assertSuperAdmin, {});
    if (args.amountCents <= 0) throw new Error("Amount must be positive");
    const label =
      args.tier === "basic"
        ? "Starter"
        : args.tier === "professional"
          ? "Professional"
          : "Enterprise";
    const { plan_code } = await paystack.createPlan({
      name: `RoomBook ${label} (R${(args.amountCents / 100).toFixed(2)})`,
      amount: args.amountCents,
    });
    await ctx.runMutation(internal.pricing.setPlanCode, {
      tier: args.tier,
      planCode: plan_code,
    });
    return { ok: true, planCode: plan_code };
  },
});
