"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Option {
  id: string;
  name: string;
}

export function BrandLinkControl({ productId, currentBrandId }: { productId: string; currentBrandId: string | null }) {
  const router = useRouter();
  const [brands, setBrands] = useState<Option[]>([]);
  const [value, setValue] = useState(currentBrandId ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((d) => setBrands((d.brands ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))));
  }, []);

  async function handleChange(brandId: string) {
    setValue(brandId);
    setSubmitting(true);
    await fetch(`/api/products/${productId}/brand`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: brandId || null }),
    });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--kw-text-muted)" }}>Brand CRM link:</span>
      <select value={value} onChange={(e) => handleChange(e.target.value)} disabled={submitting}>
        <option value="">Not linked</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {value && (
        <a href={`/brand-crm/${value}`} style={{ fontSize: 12, color: "var(--kw-accent-primary)" }}>
          View brand
        </a>
      )}
    </div>
  );
}
