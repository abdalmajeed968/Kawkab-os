"use client";

import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { RoleBadge } from "./RoleBadge";

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/documents": "Documents",
  "/products": "Products",
  "/purchases": "Purchases",
  "/suppliers": "Suppliers",
  "/inventory": "Inventory",
  "/sales": "Sales",
  "/imports": "Imports",
  "/settings/users": "User management",
  "/settings/audit-log": "Audit log",
};

function titleFor(pathname: string | null): string {
  if (!pathname) return "KAWKAB OS";
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/products/")) return "Product";
  if (pathname.startsWith("/purchases/")) return "Purchase";
  if (pathname.startsWith("/sales/")) return "Sale";
  if (pathname.startsWith("/imports/")) return "Import";
  return "KAWKAB OS";
}

export function TopBar({ userName, role }: { userName: string; role: string }) {
  const pathname = usePathname();
  return (
    <header className="topbar">
      <div className="topbar-page-title">{titleFor(pathname)}</div>
      <div className="topbar-user">
        <span>{userName}</span>
        <RoleBadge role={role} />
        <button className="logout-button" onClick={() => signOut({ callbackUrl: "/login" })}>
          Log out
        </button>
      </div>
    </header>
  );
}
