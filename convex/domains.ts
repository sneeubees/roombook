import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getMembership, isSuperAdminUser, requireMembership, requireOwner } from "./authz";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.orgId);
    return await ctx.db
      .query("domains")
      .withIndex("by_domain")
      .collect()
      .then((domains) => domains.filter((d) => d.orgId === args.orgId));
  },
});

export const getByDomain = query({
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    const domainRecord = await ctx.db
      .query("domains")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain.toLowerCase()))
      .unique();

    if (!domainRecord || !domainRecord.isVerified) return null;

    const org = await ctx.db.get(domainRecord.orgId);
    return org ? { domain: domainRecord, org } : null;
  },
});

export const add = mutation({
  args: {
    orgId: v.id("organizations"),
    domain: v.string(),
  },
  handler: async (ctx, args) => {
    // White-label domains are an owner-only, Enterprise-tier feature.
    await requireOwner(ctx, args.orgId);
    const org = await ctx.db.get(args.orgId);
    if ((org?.subscriptionTier ?? "basic") !== "enterprise") {
      throw new Error(
        "White-label domains are available on the Enterprise plan only"
      );
    }

    const domain = args.domain.toLowerCase().trim();

    // Check if domain already exists
    const existing = await ctx.db
      .query("domains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .unique();

    if (existing) {
      throw new Error("This domain is already registered");
    }

    return await ctx.db.insert("domains", {
      orgId: args.orgId,
      domain,
      isVerified: false,
    });
  },
});

export const markVerified = mutation({
  args: { id: v.id("domains") },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.id);
    if (!domain) throw new Error("Domain not found");
    await requireOwner(ctx, domain.orgId);
    await ctx.db.patch(args.id, {
      isVerified: true,
      verifiedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("domains") },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.id);
    if (!domain) throw new Error("Domain not found");
    await requireOwner(ctx, domain.orgId);
    await ctx.db.delete(args.id);
  },
});

/**
 * Returns the domain record if the signed-in caller is the OWNER of the org
 * that registered it (or a super admin), else null. Used by the VPS domain
 * provisioning route to authorize nginx/certbot changes for a domain.
 */
export const getOwnedByCaller = query({
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const domain = await ctx.db
      .query("domains")
      .withIndex("by_domain", (q) =>
        q.eq("domain", args.domain.toLowerCase().trim())
      )
      .unique();
    if (!domain) return null;
    const membership = await getMembership(ctx, domain.orgId, userId);
    const superAdmin = await isSuperAdminUser(ctx, userId);
    if (membership?.role === "owner" || superAdmin) {
      return domain;
    }
    return null;
  },
});
