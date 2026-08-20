// lib/session.ts
//
// Fixes a real bug found in local testing: a /dashboard redirect loop.
// Root cause — middleware.ts (using next-auth/jwt's getToken()) and every
// individual page/layout (using auth(), which runs the full session
// callback chain) were BOTH independently deciding whether to redirect to
// /login. Those are two different code paths reading session state in
// different ways; if they ever disagree even briefly, you get exactly a
// loop: middleware sends an authenticated user away from /login toward
// /dashboard, the page decides the session looks empty and sends them
// back to /login, forever.
//
// The fix is to have exactly one authority. middleware.ts owns the
// login-redirect decision — it runs on every request via the matcher in
// middleware.ts, before any page component executes. Pages and layouts
// only need to READ who's logged in, never decide whether to redirect.
// This helper does that, and never redirects.

import { auth } from "./auth";
import { Role } from "./permissions";

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

/**
 * Reads the current session user. Does NOT redirect. If session is ever
 * genuinely missing here, middleware failed to do its job — that's a real
 * bug worth surfacing loudly (via Next.js's error boundary), not a case
 * to silently paper over with yet another redirect.
 */
export async function getSessionUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    throw new Error(
      "No authenticated session found in a route middleware should already have protected. " +
        "This indicates a bug in middleware.ts, not a normal 'please log in' state."
    );
  }
  const user = session.user as { id?: string; name?: string | null; role?: string };
  return {
    id: user.id ?? "",
    name: user.name ?? "Unknown",
    role: (user.role as Role) ?? "OPERATOR",
  };
}
