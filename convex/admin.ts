import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-shot: mark every existing password-auth account as already verified
 * so Convex Auth's `verify` flow doesn't send those users through the OTP
 * step on sign-in. Also sets emailVerificationTime on the user row for
 * good measure.
 *
 * Run once after turning on Password({ verify: ResendOTP }).
 */
export const backfillEmailVerification = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let usersUpdated = 0;
    for (const u of users) {
      if (!(u as { emailVerificationTime?: number }).emailVerificationTime) {
        await ctx.db.patch(u._id, { emailVerificationTime: Date.now() });
        usersUpdated++;
      }
    }

    // Convex Auth's signIn check is on authAccounts.emailVerified — that's
    // the field the Password provider gates on. Set it to the account's
    // email (which is what the verifyCodeAndSignIn mutation does).
    const accounts = await ctx.db.query("authAccounts").collect();
    let accountsUpdated = 0;
    for (const a of accounts) {
      const acct = a as unknown as {
        provider?: string;
        providerAccountId?: string;
        emailVerified?: string;
      };
      if (acct.provider !== "password") continue;
      if (!acct.emailVerified) {
        await ctx.db.patch(a._id, {
          emailVerified: acct.providerAccountId,
        });
        accountsUpdated++;
      }
    }

    return {
      usersUpdated,
      totalUsers: users.length,
      accountsUpdated,
      totalPasswordAccounts: accounts.filter(
        (a) => (a as unknown as { provider?: string }).provider === "password"
      ).length,
    };
  },
});

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
