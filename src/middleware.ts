import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/invite(.*)",
  "/api/webhooks(.*)",
  "/api/domains(.*)",
]);

const MAIN_DOMAINS = ["roombook.co.za", "www.roombook.co.za", "localhost"];

export default clerkMiddleware(async (auth, request) => {
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  const isCustomDomain = !MAIN_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith("localhost")
  );

  // Set custom domain header for downstream components
  const response = NextResponse.next();
  if (isCustomDomain && hostname) {
    response.headers.set("x-custom-domain", hostname);
    // Also set a cookie so client-side can read it
    response.cookies.set("custom-domain", hostname, {
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "lax",
    });
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
