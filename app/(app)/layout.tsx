import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { getSessionUser } from "@/lib/session";

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
