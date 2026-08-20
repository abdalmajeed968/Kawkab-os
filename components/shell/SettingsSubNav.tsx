import Link from "next/link";

type SettingsTab = "profile" | "business" | "marketplaces" | "integrations" | "users" | "audit-log";

const TABS: Array<{ key: SettingsTab; href: string; label: string }> = [
  { key: "profile", href: "/settings/profile", label: "Profile" },
  { key: "business", href: "/settings/business", label: "Business" },
  { key: "marketplaces", href: "/settings/marketplaces", label: "Marketplaces" },
  { key: "integrations", href: "/settings/integrations", label: "Integrations" },
  { key: "users", href: "/settings/users", label: "Users" },
  { key: "audit-log", href: "/settings/audit-log", label: "Audit log" },
];

export function SettingsSubNav({ active }: { active: SettingsTab }) {
  return (
    <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--kw-border)", paddingBottom: 12, flexWrap: "wrap" }}>
      {TABS.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          style={{ fontSize: 13, color: active === t.key ? "var(--kw-accent-primary)" : "var(--kw-text-secondary)" }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
