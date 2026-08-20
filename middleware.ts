// middleware.ts
//
// Gates every route under (app) behind a real session. Deliberately does
// NOT import lib/auth (the full Auth.js config with PrismaAdapter) — that
// transitively pulls Prisma Client into this file, and Next.js runs
// middleware on the Edge runtime by default, where Prisma Client cannot
// run at all ("Prisma Client cannot run in Edge Runtime" at build time).
// This was found during real local validation of the Phase 0 build, not
// anticipated in advance.
//
// getToken() from next-auth/jwt reads and verifies the same signed JWT
// session cookie lib/auth.ts issues, using only AUTH_SECRET — no Prisma,
// no database call, safe for the Edge runtime. Role-specific checks
// (Owner-only routes) still happen per-route via requirePermission() in
// the actual route handlers, which run in the Node runtime and can use
// Prisma freely — this middleware only answers "is anyone logged in."

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    // Explicit rather than left to getToken's auto-detection from the
    // request URL — auto-detection is a known source of cookie-name
    // mismatches (Auth.js uses a __Secure- prefixed cookie name over
    // HTTPS) when running behind a proxy or in an environment where the
    // request URL doesn't perfectly reflect how the browser reached it.
    secureCookie: process.env.NODE_ENV === "production",
  });
  const isLoggedIn = !!token && !token.revoked;
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login");

  if (!isLoggedIn && !isAuthRoute) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
