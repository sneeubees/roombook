import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// NOTE: email verification (Password + verify: ResendOTP) was turned off
// because existing accounts created before the verify requirement don't
// have an emailVerificationTime and would be locked out. Re-enable after
// running the admin.backfillEmailVerification one-shot on existing users.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        return {
          email: params.email as string,
          name: (params.name as string | undefined) ?? "",
        };
      },
    }),
  ],
});
