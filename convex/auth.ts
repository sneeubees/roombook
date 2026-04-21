import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Requires the user to enter a 6-digit OTP (emailed via Resend) before
      // the account is fully signed in. Gates org creation / super-admin
      // approval downstream.
      verify: ResendOTP,
      profile(params) {
        return {
          email: params.email as string,
          name: (params.name as string | undefined) ?? "",
        };
      },
    }),
  ],
});
