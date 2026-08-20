"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KawkabLogo } from "./KawkabLogo";

interface NavItem {
  label: string;
  href: string;
  enabled: boolean;
  phaseTag?: string; // shown when disabled
}

// Primary nav is scoped to the core operating workflow (Products ->
// Purchases -> Inventory -> Sales/Imports -> Finance -> Dashboard/Reports)
// plus Suppliers and Documents, which directly support that workflow.
// Boxes, Shipments, Brand CRM, and Research are fully built and still
// reachable by direct URL — they're just not primary-nav items until the
// business actually needs them day to day. Nothing here was deleted.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", enabled: true },
  { label: "Products", href: "/products", enabled: true },
  { label: "Purchases", href: "/purchases", enabled: true },
  { label: "Inventory", href: "/inventory", enabled: true },
  { label: "Sales", href: "/sales", enabled: true },
  { label: "Imports", href: "/imports", enabled: true },
  { label: "Finance", href: "/finance", enabled: true },
  { label: "Reports", href: "/reports", enabled: true },
  { label: "Suppliers", href: "/suppliers", enabled: true },
  { label: "Documents", href: "/documents", enabled: true },
  { label: "Settings", href: "/settings/users", enabled: true },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="sidebar">
      <div className="sidebar-logo" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <KawkabLogo size={22} />
        <span>KAWKAB OS</span>
      </div>
      <div className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.enabled && pathname?.startsWith(item.href);
          if (!item.enabled) {
            return (
              <div
                key={item.label}
                className="sidebar-link sidebar-link-disabled"
                aria-disabled="true"
                title={`Available in ${item.phaseTag}`}
              >
                <span>{item.label}</span>
                <span className="sidebar-phase-tag">{item.phaseTag}</span>
              </div>
            );
          }
          return (
            <Link key={item.label} href={item.href} className={`sidebar-link ${isActive ? "sidebar-link-active" : ""}`}>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
