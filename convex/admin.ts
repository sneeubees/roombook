import { mutation } from "./_generated/server";
import { v } from "convex/values";

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
