"use client";

const TABS: Array<{ key: string; label: string; amazonDependent?: boolean }> = [
  { key: "all", label: "All Products" },
  { key: "most_profitable", label: "Most Profitable", amazonDependent: true },
  { key: "best_selling", label: "Best Selling", amazonDependent: true },
  { key: "needs_reorder", label: "Needs Reorder", amazonDependent: true },
  { key: "losing_money", label: "Losing Money", amazonDependent: true },
  { key: "incomplete_data", label: "Incomplete Data" },
  { key: "paused", label: "Paused" },
];

export function ProductTabs({ active, onChange }: { active: string; onChange: (tab: string) => void }) {
  return (
    <div className="tab-row">
      {TABS.map((t) => (
        <button
          key={t.key}
          className={`tab-item ${active === t.key ? "tab-item-active" : ""} ${t.amazonDependent ? "tab-item-amazon" : ""}`}
          onClick={() => onChange(t.key)}
          title={t.amazonDependent ? "Waiting for Amazon data" : undefined}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const AMAZON_DEPENDENT_TAB_KEYS = TABS.filter((t) => t.amazonDependent).map((t) => t.key);
