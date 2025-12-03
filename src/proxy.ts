import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/account-deleted(.*)",
  "/api/cron/(.*)", // Cron routes should be public (protected by secret)
  "/api/clerk/webhook(.*)", // Clerk webhooks (protected by signature verification)
]);

export const proxy = clerkMiddleware(async (auth, request) => {
  // Add pathname to headers for layout to access
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  // Protect non-public routes
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

