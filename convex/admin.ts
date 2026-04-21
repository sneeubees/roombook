import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * DEV-ONLY: Bootstrap the first super admin by email, activate any org they
 * belong to. Only runs if no super admin currently exists.
 */
export const bootstrapSuperAdmin = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const profiles = await ctx.db.query("userProfiles").collect();
    if (profiles.some((p) => p.isSuperAdmin)) {
      throw new Error("A super admin already exists");
    }

    const users = await ctx.db.query("users").collect();
    const user = users.find(
      (u) => (u as { email?: string }).email === args.email
    );
    if (!user) throw new Error(`No user with email ${args.email}`);

    const existingProfile = profiles.find((p) => p.userId === user._id);
    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, { isSuperAdmin: true });
    } else {
      await ctx.db.insert("userProfiles", {
        userId: user._id,
        isSuperAdmin: true,
      });
    }

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    let approvedOrgs = 0;
    for (const m of memberships) {
      const org = await ctx.db.get(m.orgId);
      if (org && org.status !== "active") {
        await ctx.db.patch(m.orgId, { status: "active" });
        approvedOrgs++;
      }
    }

    return {
      userId: user._id,
      email: args.email,
      approvedOrgs,
    };
  },
});

/**
 * DEV-ONLY: Wipes all data except super admin users.
 * Should be removed before production launch.
 */
export const wipeAll = mutation({
  args: { confirmKeyword: v.string() },
  handler: async (ctx, args) => {
    if (args.confirmKeyword !== "WIPE_EVERYTHING") {
      throw new Error("Confirmation keyword required");
    }

    const counts: Record<string, number> = {};

    // Delete all tables
    const tables = [
      "bookings",
      "roomBlocks",
      "rooms",
      "waitlist",
      "invoices",
      "invoiceLineItems",
      "invitations",
      "notifications",
      "domains",
      "organizations",
      "activityLogs",
      "users",
    ] as const;

    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      counts[table] = rows.length;
    }

    return counts;
  },
});
