import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  MutationCtx,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

const GRACE_DAYS = 5;

type Tier = "basic" | "professional" | "enterprise";

type PaystackEventData = {
  customer?: { customer_code?: string };
  subscription_code?: string;
  plan?: { plan_code?: string; name?: string } | string;
  next_payment_date?: string;
  email_token?: string;
  metadata?: Record<string, unknown> | string;
  status?: string;
};

type PaystackEvent = { event?: string; data?: PaystackEventData };

function parseMetadata(meta: unknown): Record<string, unknown> {
  if (typeof meta === "string") {
    try {
      return JSON.parse(meta) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (meta as Record<string, unknown> | undefined) ?? {};
}

// Find the RoomBook org an event belongs to: metadata.orgId (present on our
// own initialize) → subscription code → customer code. Returns null for
// events that belong to another product (the gateway broadcasts metadata-less
// lifecycle events to everyone) — the caller then simply acks and ignores.
async function findOrg(
  ctx: MutationCtx,
  event: PaystackEvent
): Promise<Doc<"organizations"> | null> {
  const data = event.data ?? {};
  const meta = parseMetadata(data.metadata);

  const orgId = meta.orgId;
  if (typeof orgId === "string") {
    const org = await ctx.db.get(orgId as Id<"organizations">);
    if (org) return org;
  }

  const subCode = data.subscription_code;
  if (subCode) {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_paystack_subscription", (q) =>
        q.eq("paystackSubscriptionCode", subCode)
      )
      .unique();
    if (org) return org;
  }

  const custCode = data.customer?.customer_code;
  if (custCode) {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_paystack_customer", (q) =>
        q.eq("paystackCustomerCode", custCode)
      )
      .unique();
    if (org) return org;
  }

  return null;
}

function tierFromEvent(
  event: PaystackEvent,
  org: Doc<"organizations">
): Tier | undefined {
  const meta = parseMetadata(event.data?.metadata);
  const t = meta.tier;
  if (t === "basic" || t === "professional" || t === "enterprise") return t;
  const planCode =
    typeof event.data?.plan === "object" ? event.data?.plan?.plan_code : undefined;
  if (planCode) {
    if (planCode === process.env.PAYSTACK_PLAN_BASIC) return "basic";
    if (planCode === process.env.PAYSTACK_PLAN_PROFESSIONAL) return "professional";
    if (planCode === process.env.PAYSTACK_PLAN_ENTERPRISE) return "enterprise";
  }
  return org.subscriptionTier;
}

// Single transactional entry point for the webhook: dedupe + apply together so
// an event is processed exactly once even under Paystack's retries.
export const handleEvent = internalMutation({
  args: { dedupeKey: v.string(), eventType: v.string(), payload: v.any() },
  handler: async (ctx, args) => {
    const already = await ctx.db
      .query("paystackEvents")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", args.dedupeKey))
      .unique();
    if (already) return { ok: true, deduped: true };

    const event = args.payload as PaystackEvent;
    const org = await findOrg(ctx, event);

    await ctx.db.insert("paystackEvents", {
      dedupeKey: args.dedupeKey,
      eventType: args.eventType,
      orgId: org?._id,
      payload: args.payload,
      processedAt: Date.now(),
    });

    // Authentic event, but not for a RoomBook org — ack and ignore.
    if (!org) return { ok: true, ignored: true };

    const data = event.data ?? {};
    const now = Date.now();
    const nextPeriodEnd = data.next_payment_date
      ? Date.parse(data.next_payment_date)
      : undefined;
    const advancePeriod =
      typeof nextPeriodEnd === "number" &&
      !Number.isNaN(nextPeriodEnd) &&
      (!org.currentPeriodEnd || nextPeriodEnd > org.currentPeriodEnd);
    const planCode =
      typeof data.plan === "object" ? data.plan?.plan_code : undefined;
    const custCode = data.customer?.customer_code;

    switch (args.eventType) {
      case "charge.success":
      case "subscription.create": {
        await ctx.db.patch(org._id, {
          status: "active",
          paymentMethod: "paystack",
          subscriptionStatus: "active",
          subscriptionTier: tierFromEvent(event, org),
          graceUntil: undefined,
          ...(custCode ? { paystackCustomerCode: custCode } : {}),
          ...(data.subscription_code
            ? { paystackSubscriptionCode: data.subscription_code }
            : {}),
          ...(data.email_token ? { paystackEmailToken: data.email_token } : {}),
          ...(planCode ? { paystackPlanCode: planCode } : {}),
          ...(advancePeriod ? { currentPeriodEnd: nextPeriodEnd } : {}),
        });
        break;
      }
      case "invoice.payment_failed": {
        await ctx.db.patch(org._id, {
          subscriptionStatus: "attention",
          graceUntil: now + GRACE_DAYS * 24 * 60 * 60 * 1000,
        });
        break;
      }
      case "subscription.not_renew": {
        await ctx.db.patch(org._id, { subscriptionStatus: "non-renewing" });
        break;
      }
      case "subscription.disable": {
        // Only act if this targets the org's CURRENT subscription, so a late
        // duplicate for a superseded subscription can't suspend a re-subscribed org.
        if (
          !data.subscription_code ||
          data.subscription_code === org.paystackSubscriptionCode
        ) {
          await ctx.db.patch(org._id, {
            subscriptionStatus: "cancelled",
            status: "suspended",
          });
        }
        break;
      }
      default:
        break;
    }
    return { ok: true };
  },
});

export const getCheckoutInfo = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;
    let email = org.email ?? undefined;
    if (!email && org.ownerUserId) {
      const owner = await ctx.db.get(org.ownerUserId);
      email = (owner as { email?: string } | null)?.email ?? undefined;
    }
    if (!email) return null;
    return {
      email,
      name: org.name,
      paystackCustomerCode: org.paystackCustomerCode ?? null,
    };
  },
});

export const setCustomerCode = internalMutation({
  args: { orgId: v.id("organizations"), customerCode: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, { paystackCustomerCode: args.customerCode });
  },
});

export const getSubscriptionInfo = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;
    return {
      subscriptionCode: org.paystackSubscriptionCode ?? null,
      emailToken: org.paystackEmailToken ?? null,
    };
  },
});

export const markNonRenewing = internalMutation({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orgId, { subscriptionStatus: "non-renewing" });
  },
});

// Daily dunning sweep: suspend orgs whose failed-payment grace window has
// elapsed. Suspension is already enforced on writes (rooms / invoice gen).
export const dunningSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const orgs = await ctx.db.query("organizations").collect();
    let suspended = 0;
    for (const org of orgs) {
      if (
        org.subscriptionStatus === "attention" &&
        org.graceUntil &&
        org.graceUntil < now &&
        org.status !== "suspended"
      ) {
        await ctx.db.patch(org._id, { status: "suspended" });
        suspended++;
      }
    }
    return { suspended };
  },
});
