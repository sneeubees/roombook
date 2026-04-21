import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-up",
  "/invite/(.*)",
  "/api/webhooks/(.*)",
  "/api/domains/(.*)",
  "/api/calendar/(.*)",
  "/api/email/(.*)",
]);

const isAuthPage = createRouteMatcher(["/sign-in", "/sign-up"]);

const MAIN_DOMAINS = ["roombook.co.za", "www.roombook.co.za"];

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const authed = await convexAuth.isAuthenticated();

  if (!isPublicRoute(request) && !authed) {
    return nextjsMiddlewareRedirect(request, "/sign-in");
  }

  if (isAuthPage(request) && authed) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
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
