// lib/dataHealth.ts
//
// Section 10 of the Phase 1A spec. A percentage plus a checklist, computed
// on read from real Product/Purchase/Document data — not stored, so it
// can never drift out of sync with the rows it's describing. The one rule
// this module exists to enforce: a field that's missing because the
// owner hasn't entered it yet, and a field that's missing because Amazon
// integration doesn't exist yet, are never conflated into the same kind
// of "missing."

export type DataHealthCheckState = "OK" | "MISSING" | "NOT_AVAILABLE_YET";

export interface DataHealthCheck {
  label: string;
  state: DataHealthCheckState;
}

export interface DataHealthResult {
  percent: number; // out of the KAWKAB-controllable checks only — Amazon
  // checks are shown but never counted against the score, per the Owner's
  // explicit instruction not to count future Amazon data as an error.
  checks: DataHealthCheck[];
}

interface ProductForHealthCheck {
  purchaseItems: Array<{
    purchase: {
      invoiceTotal: unknown;
      supplierShipping: unknown;
      packagingCost: unknown;
      completenessStatus: string;
      supplierId: string | null;
      documents: unknown[];
    };
  }>;
}

export function computeProductDataHealth(product: ProductForHealthCheck): DataHealthResult {
  const hasPurchase = product.purchaseItems.length > 0;
  const latestPurchase = hasPurchase ? product.purchaseItems[0].purchase : null;

  const kawkabChecks: DataHealthCheck[] = [
    { label: "Purchase recorded", state: hasPurchase ? "OK" : "MISSING" },
    { label: "Supplier", state: latestPurchase?.supplierId ? "OK" : "MISSING" },
    { label: "Purchase cost", state: latestPurchase?.invoiceTotal != null ? "OK" : "MISSING" },
    {
      label: "Supplier shipping",
      state: latestPurchase ? (latestPurchase.supplierShipping != null ? "OK" : "MISSING") : "MISSING",
    },
    {
      label: "Packaging cost",
      state: latestPurchase ? (latestPurchase.packagingCost != null ? "OK" : "MISSING") : "MISSING",
    },
    {
      label: "Invoice document",
      state: latestPurchase && latestPurchase.documents.length > 0 ? "OK" : "MISSING",
    },
  ];

  const amazonChecks: DataHealthCheck[] = [{ label: "Amazon data", state: "NOT_AVAILABLE_YET" }];

  const okCount = kawkabChecks.filter((c) => c.state === "OK").length;
  const percent = Math.round((okCount / kawkabChecks.length) * 100);

  return { percent, checks: [...kawkabChecks, ...amazonChecks] };
}
