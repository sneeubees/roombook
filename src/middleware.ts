import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
  "/api/webhooks(.*)",
  "/api/domains(.*)",
  "/api/calendar(.*)",
  "/api/invoices(.*)",
  "/api/email(.*)",
]);

const MAIN_DOMAINS = ["roombook.co.za", "www.roombook.co.za"];

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    try {
      await auth.protect();
    } catch {
      // On hard refresh in Clerk dev mode, auth.protect() fails
      // because dev browser token is missing. Redirect to sign-in.
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect_url", request.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Detect custom domain and set cookie for client-side use
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  const isCustomDomain =
    hostname !== "" &&
    !hostname.includes("localhost") &&
    !MAIN_DOMAINS.includes(hostname);

  if (isCustomDomain) {
    const response = NextResponse.next();
    response.cookies.set("custom-domain", hostname, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
    return response;
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
