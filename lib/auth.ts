// lib/auth.ts
//
// Auth.js (NextAuth v5) with the Credentials provider. This replaces the
// old prototype's request-header identity stand-in entirely — every
// request resolves identity from a real, signed, httpOnly session cookie,
// never a client-supplied value.
//
// FLAGGED DEVIATION FROM THE PHASE 0 PLAN, found during implementation,
// not before it — the plan described a database ("Session" table) session
// strategy. Auth.js's Credentials provider does not support automatic
// database sessions the way an OAuth provider does (the adapter has
// nowhere to persist a session on a plain email/password sign-in without
// custom wiring). This is a known, documented Auth.js constraint, not a
// design opinion — verify against current Auth.js docs once npm install
// can actually run, since this was written without network access to
// confirm the exact current behavior.
//
// What ships instead: JWT-strategy sessions (signed, httpOnly, tamper-
// proof), with role and status re-read from Postgres on every token
// refresh via the jwt callback below — so suspending a user (status ->
// SUSPENDED) or changing their role takes effect on their next request
// without needing a live database Session row to revoke. This is close
// to, but not identical to, true server-side revocability — a genuine
// instant-revoke would still need a denylist or a short token lifetime.
// The Session model stays in schema.prisma regardless, since Auth.js's
// Prisma adapter expects it and any future OAuth provider would use it.

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { writeAuditLog } from "./audit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // 12h — short-lived by design, see note above
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status !== "ACTIVE") return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // A custom jwt callback REPLACES Auth.js's default token population
      // entirely — name/email are not carried over automatically just
      // because `user` is present. Explicit here on purpose, since a
      // silently-empty token.name/email was one of the candidate causes
      // investigated for the /dashboard redirect loop found in local
      // testing (see lib/session.ts for the actual root cause and fix).
      if (user) {
        token.role = (user as { role: string }).role;
        token.uid = user.id as string;
        token.name = user.name;
        token.email = user.email;
      }
      // Re-check status/role on every token refresh, not just at login —
      // this is the mechanism that approximates revocation (see note above).
      if (token.uid) {
        const current = await prisma.user.findUnique({ where: { id: token.uid as string } });
        if (!current || current.status !== "ACTIVE") {
          return { ...token, revoked: true };
        }
        token.role = current.role;
        token.name = current.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.revoked) {
        // Signals to middleware/route handlers that this session is dead
        // even though the JWT itself hasn't expired yet.
        session.user = undefined as never;
        return session;
      }
      // Always construct session.user from the token directly, rather
      // than only mutating it if NextAuth happened to have already
      // populated one — defensive against exactly the kind of "session
      // looks empty even though the token is valid" state that caused
      // the redirect loop.
      session.user = {
        ...session.user,
        id: token.uid as string,
        name: (token.name as string) ?? "Unknown",
        email: (token.email as string) ?? session.user?.email ?? "",
        role: token.role as string,
      } as never;
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await prisma.auditLog.create({
        data: { userId: user.id!, action: "LOGIN", entityType: "User", entityId: user.id!, source: "MANUAL" },
      });
    },
    async signOut(message) {
      const userId = "token" in message ? (message.token?.uid as string | undefined) : undefined;
      if (userId) {
        await prisma.auditLog.create({
          data: { userId, action: "LOGOUT", entityType: "User", entityId: userId, source: "MANUAL" },
        });
      }
    },
  },
});

// Re-exported so callers don't need to know writeAuditLog lives in a
// different module just to log LOGIN/LOGOUT — kept here for discoverability.
export { writeAuditLog };
