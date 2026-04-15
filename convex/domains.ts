import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, args) => {
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
    await ctx.db.patch(args.id, {
      isVerified: true,
      verifiedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("domains") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
