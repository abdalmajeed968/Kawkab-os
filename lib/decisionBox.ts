// lib/decisionBox.ts
//
// Section 12 of the Phase 1A spec. A pure computed summary — no table of
// its own. Storing a "decision" as a cached row risks it going stale the
// moment a purchase or eligibility record changes; computing it fresh
// from data that's already the source of truth (Product, PurchaseItem,
// ProductEligibility) means it can never disagree with the data it's
// summarizing. Phase 1A's version is a plain internal-data summary — the
// spec is explicit that AI-powered recommendations come later and must
// never be fabricated from data that doesn't exist yet.

import { computeProductDataHealth } from "./dataHealth";
import { computeLandedCost, MoneyLike } from "./landedCost";

interface DecisionBoxProduct {
  status: string;
  purchaseItems: Array<{
    id: string;
    productId: string;
    quantity: number;
    lineItemCost: MoneyLike;
    purchase: {
      invoiceTotal: MoneyLike;
      tax: MoneyLike | null;
      discount: MoneyLike | null;
      supplierShipping: MoneyLike | null;
      localShipping: MoneyLike | null;
      prepCost: MoneyLike | null;
      packagingCost: MoneyLike | null;
      otherCost: MoneyLike | null;
      supplierId: string | null;
      documents: unknown[];
      verificationStatus: string;
      completenessStatus: string;
    };
  }>;
  eligibility: { status: string; approvalStatus: string } | null;
}

export interface DecisionBoxResult {
  dataStatus: "COMPLETE" | "INCOMPLETE";
  acquisitionCost: "known" | "unknown" | "incomplete";
  invoiceStatus: "verified" | "needs_review" | "missing";
  amazonProfitability: "not_available_yet";
  eligibility: string;
  nextAction: string;
}

export function computeDecisionBox(product: DecisionBoxProduct): DecisionBoxResult {
  const health = computeProductDataHealth(product);
  const latestItem = product.purchaseItems[0];

  let acquisitionCost: DecisionBoxResult["acquisitionCost"] = "unknown";
  if (latestItem) {
    const [landed] = computeLandedCost(latestItem.purchase, [
      {
        id: latestItem.id,
        productId: latestItem.productId,
        quantity: latestItem.quantity,
        lineItemCost: latestItem.lineItemCost,
      },
    ]);
    acquisitionCost = landed.landedUnitCost.isComplete ? "known" : "incomplete";
  }

  const invoiceStatus: DecisionBoxResult["invoiceStatus"] = !latestItem
    ? "missing"
    : latestItem.purchase.documents.length === 0
      ? "missing"
      : latestItem.purchase.verificationStatus === "VERIFIED"
        ? "verified"
        : "needs_review";

  const eligibilityStatus = product.eligibility?.status ?? "UNKNOWN";

  let nextAction = "Record a purchase to establish acquisition cost";
  if (health.percent < 100 && latestItem) {
    const missingLabels = health.checks.filter((c) => c.state === "MISSING").map((c) => c.label);
    nextAction = `Complete missing data: ${missingLabels.join(", ")}`;
  } else if (eligibilityStatus === "RESTRICTED") {
    nextAction = "Find a qualifying supplier / brand approval path";
  } else if (eligibilityStatus === "UNKNOWN") {
    nextAction = "Check Amazon eligibility for this product";
  } else if (health.percent === 100) {
    nextAction = "Data complete — awaiting Amazon sales data to evaluate profitability";
  }

  return {
    dataStatus: health.percent === 100 ? "COMPLETE" : "INCOMPLETE",
    acquisitionCost,
    invoiceStatus,
    amazonProfitability: "not_available_yet",
    eligibility: eligibilityStatus,
    nextAction,
  };
}
