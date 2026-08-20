import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { getSessionUser } from "@/lib/session";

// Every route under this layout reads a live session and, in most cases,
// live business data straight from Postgres — none of it should ever be
// statically rendered or cached at build time. Forcing dynamic here
// (inherited by every nested page, per Next.js's App Router rules) also
// stops `next build` from attempting to execute these pages during
// "Collecting page data," which previously depended on DATABASE_URL being
// reachable from the build environment itself, not just at request time.
export const dynamic = "force-dynamic";

// No redirect here — middleware.ts is the single authority for the
// login redirect. See lib/session.ts for why: a second, independent
// redirect check here was the actual cause of the /dashboard redirect
// loop found in local testing.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopBar userName={user.name} role={user.role} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
