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

const MAIN_DOMAINS = ["roombook.co.za", "www.roombook.co.za"];

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
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
