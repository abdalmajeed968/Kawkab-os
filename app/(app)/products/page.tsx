"use client";

import { useState, useEffect } from "react";
import { ProductTabs, AMAZON_DEPENDENT_TAB_KEYS } from "@/components/products/ProductTabs";
import { ProductsTable } from "@/components/products/ProductsTable";
import { NewProductForm } from "@/components/products/NewProductForm";

export default function ProductsPage() {
  const [tab, setTab] = useState("all");
  const [products, setProducts] = useState<never[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/products?tab=${tab}`)
      .then((r) => r.json())
      .then((data) => setProducts(data.products))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ color: "var(--kw-text-secondary)", fontSize: 13, maxWidth: 560, margin: 0 }}>
          Only values KAWKAB actually has are shown. Anything Amazon-originated (revenue, units sold, fees, ROI)
          stays "Not synced" until SP-API integration exists — never a fabricated number.
        </p>
        <NewProductForm />
      </div>

      <ProductTabs active={tab} onChange={setTab} />

      {loading || !products ? (
        <div className="card">Loading…</div>
      ) : (
        <ProductsTable products={products} amazonWaiting={AMAZON_DEPENDENT_TAB_KEYS.includes(tab)} />
      )}
    </div>
  );
}
