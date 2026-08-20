// tests/salesImport.test.ts
//
// REAL integration tests against a live Postgres instance — run with
// `DATABASE_URL=<test-db-url> npm test`. Covers the Real Data / Sales
// import system end to end: CSV parsing, header normalization, product
// matching, duplicate prevention, FIFO consumption via the import
// pipeline, financial events arriving before/after sales, the revenue
// source-of-truth rule, and safe reversal. See the final implementation
// report for whether this suite was actually executed and what happened.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma";
import { createProduct } from "../lib/products";
import { createPurchase } from "../lib/purchases";
import { createSupplier } from "../lib/suppliers";
import { setProductIdentifier } from "../lib/productIdentifiers";
import { startImport, matchImportBatch, commitSalesBatch, commitFinanceBatch, resolveUnmatchedRow } from "../lib/salesImport";
import { createFinancialEvent, reconcileOrphanedFinancialEvents } from "../lib/financialEvents";
import { computeSaleItemProfit, getBusinessPerformance } from "../lib/finance";
import { getInventoryOnHand } from "../lib/inventory";
import { reverseSaleItemConsumption } from "../lib/sales";
import { PermissionError } from "../lib/permissions";

function csvBuffer(headers: string[], rows: string[][]): Buffer {
  const lines = [headers.join(","), ...rows.map((r) => r.join(","))];
  return Buffer.from(lines.join("\n"), "utf-8");
}

describe("Sales import — real Amazon data (CSV/Excel)", () => {
  let ownerId: string;
  let supplierId: string;

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { name: "Sales Import Test Owner", email: `sales-import-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OWNER" },
    });
    ownerId = owner.id;
    const supplier = await createSupplier({ name: "Sales Import Test Supplier" }, ownerId, "OWNER");
    supplierId = supplier.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function makeProductWithInventory(sku: string, quantity: number, unitCost: number) {
    const product = await createProduct({ name: `Sales Test Product ${sku}` }, ownerId, "OWNER");
    await setProductIdentifier({ productId: product.id, type: "INTERNAL_SKU", value: sku }, ownerId, "OWNER");
    await createPurchase(
      {
        supplierId,
        purchaseDate: new Date("2026-01-01"),
        invoiceNumber: `INV-${sku}`,
        invoiceTotal: unitCost * quantity,
        supplierShipping: 0,
        localShipping: 0,
        prepCost: 0,
        packagingCost: 0,
        tax: 0,
        discount: 0,
        otherCost: 0,
        items: [{ productId: product.id, quantity, unitCost }],
      },
      ownerId,
      "OWNER"
    );
    return product;
  }

  it("SALES report: parses, matches by SKU, commits, and reduces inventory exactly once", async () => {
    const sku = `SKU-${Date.now()}`;
    const product = await makeProductWithInventory(sku, 20, 5);

    const buffer = csvBuffer(
      ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
      [["ORDER-1", "ITEM-1", sku, "2", "2026-02-01", "39.98"]]
    );

    const batch = await startImport({ filename: "sales.csv", buffer, reportType: "SALES" }, ownerId, "OWNER");
    expect(batch.originalRowCount).toBe(1);

    const matchResult = await matchImportBatch(batch.id, ownerId, "OWNER");
    expect(matchResult.matched).toBe(1);
    expect(matchResult.unmatched).toBe(0);

    const commitResult = await commitSalesBatch(batch.id, ownerId, "OWNER");
    expect(commitResult.committed).toBe(1);
    expect(commitResult.failed).toBe(0);

    expect(await getInventoryOnHand(product.id)).toBe(18);

    const saleItem = await prisma.saleItem.findFirstOrThrow({ where: { productId: product.id } });
    expect(saleItem.quantity).toBe(2);

    const consumptionEvent = await prisma.consumptionEvent.findFirst({ where: { saleItemId: saleItem.id } });
    expect(consumptionEvent).not.toBeNull();
    expect(consumptionEvent!.type).toBe("AMAZON_SALE");
  });

  it("recognizes header variants via normalization (spaces/underscores/hyphens/casing)", async () => {
    const sku = `SKU-VAR-${Date.now()}`;
    await makeProductWithInventory(sku, 10, 4);

    const buffer = csvBuffer(
      ["Order ID", "Order_Item_ID", "SKU", "Quantity", "Purchase Date", "Item Price"],
      [["ORDER-VAR-1", "ITEM-VAR-1", sku, "1", "2026-02-01", "19.99"]]
    );

    const batch = await startImport({ filename: "sales-variant-headers.csv", buffer, reportType: "SALES" }, ownerId, "OWNER");
    const matchResult = await matchImportBatch(batch.id, ownerId, "OWNER");
    expect(matchResult.matched).toBe(1);

    const commitResult = await commitSalesBatch(batch.id, ownerId, "OWNER");
    expect(commitResult.committed).toBe(1);
  });

  it("duplicate file/report upload does not create duplicate sales or double-consume inventory", async () => {
    const sku = `SKU-DUP-${Date.now()}`;
    const product = await makeProductWithInventory(sku, 20, 5);

    const buffer = csvBuffer(
      ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
      [["ORDER-DUP-1", "ITEM-DUP-1", sku, "3", "2026-02-01", "59.97"]]
    );

    const batch1 = await startImport({ filename: "dup1.csv", buffer, reportType: "SALES" }, ownerId, "OWNER");
    await matchImportBatch(batch1.id, ownerId, "OWNER");
    await commitSalesBatch(batch1.id, ownerId, "OWNER");
    expect(await getInventoryOnHand(product.id)).toBe(17);

    // Re-upload the exact same report content — an overlapping date-range export.
    const batch2 = await startImport({ filename: "dup2.csv", buffer, reportType: "SALES" }, ownerId, "OWNER");
    const rows2 = await prisma.importedRow.findMany({ where: { importBatchId: batch2.id } });
    expect(rows2[0].status).toBe("DUPLICATE");

    await matchImportBatch(batch2.id, ownerId, "OWNER");
    await commitSalesBatch(batch2.id, ownerId, "OWNER");

    expect(await getInventoryOnHand(product.id)).toBe(17); // unchanged — no double consumption

    const salesForOrder = await prisma.sale.findMany({ where: { externalOrderId: "ORDER-DUP-1" } });
    expect(salesForOrder).toHaveLength(1); // no duplicate Sale header either
  });

  it("unmatched rows remain visible, preserve raw data, and can be manually resolved", async () => {
    const buffer = csvBuffer(
      ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
      [["ORDER-UNM-1", "ITEM-UNM-1", "NO-SUCH-SKU", "1", "2026-02-01", "9.99"]]
    );

    const batch = await startImport({ filename: "unmatched.csv", buffer, reportType: "SALES" }, ownerId, "OWNER");
    const matchResult = await matchImportBatch(batch.id, ownerId, "OWNER");
    expect(matchResult.unmatched).toBe(1);

    const row = await prisma.importedRow.findFirstOrThrow({ where: { importBatchId: batch.id } });
    expect(row.status).toBe("UNMATCHED");
    expect(row.rawData).toBeTruthy();

    const product = await makeProductWithInventory(`SKU-RESOLVE-${Date.now()}`, 5, 3);
    const resolved = await resolveUnmatchedRow(row.id, product.id, ownerId, "OWNER");
    expect(resolved.status).toBe("MATCHED");
    expect(resolved.matchedProductId).toBe(product.id);
  });

  it("malformed rows are preserved with an ERROR state, not silently dropped", async () => {
    const sku = `SKU-MALFORMED-${Date.now()}`;
    await makeProductWithInventory(sku, 10, 5);

    const buffer = csvBuffer(
      ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
      [["ORDER-BAD-1", "ITEM-BAD-1", sku, "not-a-number", "2026-02-01", "9.99"]]
    );

    const batch = await startImport({ filename: "malformed.csv", buffer, reportType: "SALES" }, ownerId, "OWNER");
    await matchImportBatch(batch.id, ownerId, "OWNER");
    const commitResult = await commitSalesBatch(batch.id, ownerId, "OWNER");
    expect(commitResult.failed).toBe(1);
    expect(commitResult.committed).toBe(0);

    const row = await prisma.importedRow.findFirstOrThrow({ where: { importBatchId: batch.id } });
    expect(row.status).toBe("ERROR");
    expect(row.errorMessage).toBeTruthy();
    expect(row.rawData).toBeTruthy();
  });

  it("finance events arriving AFTER a sale reconcile immediately via order/line-item ID", async () => {
    const sku = `SKU-FIN-AFTER-${Date.now()}`;
    await makeProductWithInventory(sku, 10, 5);

    const salesBatch = await startImport(
      {
        filename: "fin-after-sales.csv",
        buffer: csvBuffer(
          ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
          [["ORDER-FIN-A-1", "ITEM-FIN-A-1", sku, "1", "2026-02-01", "19.99"]]
        ),
        reportType: "SALES",
      },
      ownerId,
      "OWNER"
    );
    await matchImportBatch(salesBatch.id, ownerId, "OWNER");
    await commitSalesBatch(salesBatch.id, ownerId, "OWNER");

    const financeBatch = await startImport(
      {
        filename: "fin-after.csv",
        buffer: csvBuffer(["order-id", "order-item-id", "amount", "amount-type", "date"], [["ORDER-FIN-A-1", "ITEM-FIN-A-1", "-3.00", "REFERRAL_FEE", "2026-02-02"]]),
        reportType: "FINANCE",
      },
      ownerId,
      "OWNER"
    );
    await commitFinanceBatch(financeBatch.id, ownerId, "OWNER");

    const event = await prisma.saleFinancialEvent.findFirstOrThrow({ where: { importBatchId: financeBatch.id } });
    expect(event.saleId).not.toBeNull();
    expect(event.saleItemId).not.toBeNull();
  });

  it("finance events arriving BEFORE the matching sale are preserved, never discarded, and reconcile once the sale exists", async () => {
    const orderId = `ORDER-FIN-BEFORE-${Date.now()}`;
    const financeBatch = await startImport(
      {
        filename: "fin-before.csv",
        buffer: csvBuffer(["order-id", "amount", "amount-type", "date"], [[orderId, "-3.00", "REFERRAL_FEE", "2026-02-01"]]),
        reportType: "FINANCE",
      },
      ownerId,
      "OWNER"
    );
    await commitFinanceBatch(financeBatch.id, ownerId, "OWNER");

    const orphanEvent = await prisma.saleFinancialEvent.findFirstOrThrow({ where: { importBatchId: financeBatch.id } });
    expect(orphanEvent.saleId).toBeNull(); // preserved, not discarded, just unresolved

    const sku = `SKU-FIN-BEFORE-${Date.now()}`;
    await makeProductWithInventory(sku, 10, 5);
    const salesBatch = await startImport(
      {
        filename: "fin-before-sales.csv",
        buffer: csvBuffer(
          ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
          [[orderId, "ITEM-FIN-B-1", sku, "1", "2026-02-01", "19.99"]]
        ),
        reportType: "SALES",
      },
      ownerId,
      "OWNER"
    );
    await matchImportBatch(salesBatch.id, ownerId, "OWNER");
    await commitSalesBatch(salesBatch.id, ownerId, "OWNER");

    const { reconciled } = await reconcileOrphanedFinancialEvents();
    expect(reconciled).toBeGreaterThanOrEqual(1);

    const nowResolved = await prisma.saleFinancialEvent.findUniqueOrThrow({ where: { id: orphanEvent.id } });
    expect(nowResolved.saleId).not.toBeNull();
  });

  it("multiple financial events can belong to one SaleItem, and none overwrite each other", async () => {
    const sku = `SKU-MULTI-EVENT-${Date.now()}`;
    await makeProductWithInventory(sku, 10, 5);

    const salesBatch = await startImport(
      {
        filename: "multi-event-sales.csv",
        buffer: csvBuffer(
          ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
          [["ORDER-MULTI-1", "ITEM-MULTI-1", sku, "1", "2026-02-01", "19.99"]]
        ),
        reportType: "SALES",
      },
      ownerId,
      "OWNER"
    );
    await matchImportBatch(salesBatch.id, ownerId, "OWNER");
    await commitSalesBatch(salesBatch.id, ownerId, "OWNER");
    const saleItem = await prisma.saleItem.findFirstOrThrow({ where: { externalLineItemId: "ITEM-MULTI-1" } });

    await createFinancialEvent({ eventType: "PRODUCT_REVENUE", amount: 19.99, currency: "USD", eventDate: new Date(), externalLineItemId: "ITEM-MULTI-1" }, ownerId, "OWNER");
    await createFinancialEvent({ eventType: "REFERRAL_FEE", amount: -3.0, currency: "USD", eventDate: new Date(), externalLineItemId: "ITEM-MULTI-1" }, ownerId, "OWNER");
    await createFinancialEvent({ eventType: "FBA_FULFILLMENT_FEE", amount: -4.2, currency: "USD", eventDate: new Date(), externalLineItemId: "ITEM-MULTI-1" }, ownerId, "OWNER");
    await createFinancialEvent({ eventType: "REFUND_FEE_CREDIT", amount: 2.4, currency: "USD", eventDate: new Date(), externalLineItemId: "ITEM-MULTI-1" }, ownerId, "OWNER");

    const events = await prisma.saleFinancialEvent.findMany({ where: { saleItemId: saleItem.id } });
    expect(events.length).toBeGreaterThanOrEqual(4);

    const p = await computeSaleItemProfit(saleItem.id);
    expect(p.fees.referral).toBeCloseTo(-3.0, 2);
    expect(p.fees.fbaFulfillment).toBeCloseTo(-4.2, 2);
    expect(p.credits).toBeCloseTo(2.4, 2);
  });

  it("revenue source-of-truth rule: PRODUCT_REVENUE events supersede SaleItem price, never summed together", async () => {
    const sku = `SKU-REVENUE-RULE-${Date.now()}`;
    await makeProductWithInventory(sku, 10, 5);

    const salesBatch = await startImport(
      {
        filename: "revenue-rule-sales.csv",
        buffer: csvBuffer(
          ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
          [["ORDER-REV-1", "ITEM-REV-1", sku, "1", "2026-02-01", "19.99"]]
        ),
        reportType: "SALES",
      },
      ownerId,
      "OWNER"
    );
    await matchImportBatch(salesBatch.id, ownerId, "OWNER");
    await commitSalesBatch(salesBatch.id, ownerId, "OWNER");
    const saleItem = await prisma.saleItem.findFirstOrThrow({ where: { externalLineItemId: "ITEM-REV-1" } });

    const beforeFinance = await computeSaleItemProfit(saleItem.id);
    expect(beforeFinance.revenue.source).toBe("sale_item_fallback");
    expect(beforeFinance.revenue.value).toBeCloseTo(19.99, 2);

    await createFinancialEvent({ eventType: "PRODUCT_REVENUE", amount: 18.5, currency: "USD", eventDate: new Date(), externalLineItemId: "ITEM-REV-1" }, ownerId, "OWNER");

    const afterFinance = await computeSaleItemProfit(saleItem.id);
    expect(afterFinance.revenue.source).toBe("financial_events");
    expect(afterFinance.revenue.value).toBeCloseTo(18.5, 2); // NOT 19.99 + 18.5
  });

  it("missing financial data is never treated as $0 — completeness is explicit", async () => {
    const sku = `SKU-INCOMPLETE-${Date.now()}`;
    await makeProductWithInventory(sku, 10, 5);

    const salesBatch = await startImport(
      {
        filename: "incomplete-sales.csv",
        buffer: csvBuffer(
          ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
          [["ORDER-INCOMPLETE-1", "ITEM-INCOMPLETE-1", sku, "1", "2026-02-01", "19.99"]]
        ),
        reportType: "SALES",
      },
      ownerId,
      "OWNER"
    );
    await matchImportBatch(salesBatch.id, ownerId, "OWNER");
    await commitSalesBatch(salesBatch.id, ownerId, "OWNER");
    const saleItem = await prisma.saleItem.findFirstOrThrow({ where: { externalLineItemId: "ITEM-INCOMPLETE-1" } });

    const p = await computeSaleItemProfit(saleItem.id);
    expect(p.fees.hasAnyFeeEvent).toBe(false);
    expect(p.isFullyComplete).toBe(false);
    expect(p.profit.isComplete).toBe(false);
  });

  it("COGS is read directly from FIFO's BatchConsumption, never recomputed independently", async () => {
    const sku = `SKU-COGS-${Date.now()}`;
    await makeProductWithInventory(sku, 10, 7.5);

    const salesBatch = await startImport(
      {
        filename: "cogs-sales.csv",
        buffer: csvBuffer(
          ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
          [["ORDER-COGS-1", "ITEM-COGS-1", sku, "2", "2026-02-01", "39.98"]]
        ),
        reportType: "SALES",
      },
      ownerId,
      "OWNER"
    );
    await matchImportBatch(salesBatch.id, ownerId, "OWNER");
    await commitSalesBatch(salesBatch.id, ownerId, "OWNER");
    const saleItem = await prisma.saleItem.findFirstOrThrow({ where: { externalLineItemId: "ITEM-COGS-1" } });

    const consumptionEvent = await prisma.consumptionEvent.findFirstOrThrow({ where: { saleItemId: saleItem.id }, include: { consumptions: true } });
    const expectedCogs = consumptionEvent.consumptions.reduce((s, c) => s + Number(c.landedUnitCost ?? c.unitPurchaseCost) * c.quantity, 0);

    const p = await computeSaleItemProfit(saleItem.id);
    expect(p.cogs.value).toBeCloseTo(expectedCogs, 2);
    expect(p.cogs.value).toBeCloseTo(15.0, 2);
  });

  it("reversal safely restores inventory", async () => {
    const sku = `SKU-REVERSE-${Date.now()}`;
    const product = await makeProductWithInventory(sku, 10, 5);

    const salesBatch = await startImport(
      {
        filename: "reverse-sales.csv",
        buffer: csvBuffer(
          ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
          [["ORDER-REVERSE-1", "ITEM-REVERSE-1", sku, "3", "2026-02-01", "59.97"]]
        ),
        reportType: "SALES",
      },
      ownerId,
      "OWNER"
    );
    await matchImportBatch(salesBatch.id, ownerId, "OWNER");
    await commitSalesBatch(salesBatch.id, ownerId, "OWNER");
    expect(await getInventoryOnHand(product.id)).toBe(7);

    const saleItem = await prisma.saleItem.findFirstOrThrow({ where: { externalLineItemId: "ITEM-REVERSE-1" } });
    await reverseSaleItemConsumption(saleItem.id, "Customer returned the order", ownerId, "OWNER");

    expect(await getInventoryOnHand(product.id)).toBe(10);
  });

  it("commit is idempotent — re-running commitSalesBatch never double-consumes an already-committed row", async () => {
    const sku = `SKU-IDEMPOTENT-${Date.now()}`;
    const product = await makeProductWithInventory(sku, 10, 5);

    const salesBatch = await startImport(
      {
        filename: "idempotent-sales.csv",
        buffer: csvBuffer(
          ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
          [["ORDER-IDEMPOTENT-1", "ITEM-IDEMPOTENT-1", sku, "1", "2026-02-01", "19.99"]]
        ),
        reportType: "SALES",
      },
      ownerId,
      "OWNER"
    );
    await matchImportBatch(salesBatch.id, ownerId, "OWNER");
    await commitSalesBatch(salesBatch.id, ownerId, "OWNER");
    expect(await getInventoryOnHand(product.id)).toBe(9);

    const secondCommit = await commitSalesBatch(salesBatch.id, ownerId, "OWNER");
    expect(secondCommit.committed).toBe(0);
    expect(await getInventoryOnHand(product.id)).toBe(9);
  });

  it("getBusinessPerformance aggregates correctly across multiple sale items in a date range", async () => {
    const sku = `SKU-BIZ-PERF-${Date.now()}`;
    await makeProductWithInventory(sku, 20, 5);

    const batch = await startImport(
      {
        filename: "biz-perf.csv",
        buffer: csvBuffer(
          ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
          [
            ["ORDER-BIZ-1", "ITEM-BIZ-1", sku, "2", "2026-03-01", "39.98"],
            ["ORDER-BIZ-2", "ITEM-BIZ-2", sku, "3", "2026-03-02", "59.97"],
          ]
        ),
        reportType: "SALES",
      },
      ownerId,
      "OWNER"
    );
    await matchImportBatch(batch.id, ownerId, "OWNER");
    await commitSalesBatch(batch.id, ownerId, "OWNER");

    const perf = await getBusinessPerformance(new Date("2026-03-01"), new Date("2026-03-03T23:59:59"), "test range");
    expect(perf.unitsSold).toBeGreaterThanOrEqual(5);
    expect(perf.totalItemCount).toBeGreaterThanOrEqual(2);
  });

  it("RBAC: AI_AGENT cannot start an import", async () => {
    const buffer = csvBuffer(["order-id"], [["ORDER-RBAC-1"]]);
    await expect(startImport({ filename: "rbac.csv", buffer, reportType: "SALES" }, "fake-ai-agent-id", "AI_AGENT")).rejects.toThrow(PermissionError);
  });

  it("RBAC: OPERATOR can import and commit sales but cannot reverse a committed sale item", async () => {
    const operator = await prisma.user.create({
      data: { name: "Sales Import Test Operator", email: `sales-import-operator-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OPERATOR" },
    });
    const sku = `SKU-RBAC-OP-${Date.now()}`;
    await makeProductWithInventory(sku, 10, 5);

    const batch = await startImport(
      {
        filename: "rbac-operator.csv",
        buffer: csvBuffer(
          ["order-id", "order-item-id", "sku", "quantity", "purchase-date", "item-price"],
          [["ORDER-RBAC-OP-1", "ITEM-RBAC-OP-1", sku, "1", "2026-02-01", "19.99"]]
        ),
        reportType: "SALES",
      },
      operator.id,
      "OPERATOR"
    );
    await matchImportBatch(batch.id, operator.id, "OPERATOR");
    await commitSalesBatch(batch.id, operator.id, "OPERATOR");

    const saleItem = await prisma.saleItem.findFirstOrThrow({ where: { externalLineItemId: "ITEM-RBAC-OP-1" } });
    await expect(reverseSaleItemConsumption(saleItem.id, "test", operator.id, "OPERATOR")).rejects.toThrow(PermissionError);
  });

  it("wide Transaction-report row (Payments > Reports Repository) splits every present fee/revenue column into its own event, never dropping columns or double-counting", async () => {
    const sku = `SKU-TXN-WIDE-${Date.now()}`;
    const product = await makeProductWithInventory(sku, 10, 5);

    const buffer = csvBuffer(
      ["date", "type", "order id", "sku", "product sales", "product sales tax", "selling fees", "fba fees", "other transaction fees", "promotional rebates", "total"],
      [["2026-03-01", "Order", "ORDER-TXN-WIDE-1", sku, "29.99", "1.50", "-4.50", "-3.25", "-0.30", "-2.00", "19.94"]]
    );

    const batch = await startImport({ filename: "transaction-report.csv", buffer, reportType: "FINANCE" }, ownerId, "OWNER");
    await matchImportBatch(batch.id, ownerId, "OWNER");
    const result = await commitFinanceBatch(batch.id, ownerId, "OWNER");
    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);

    const events = await prisma.saleFinancialEvent.findMany({ where: { importBatchId: batch.id }, orderBy: { eventType: "asc" } });
    expect(events.every((e) => e.productId === product.id)).toBe(true);
    // 6 real columns on this row: product sales, product sales tax, selling
    // fees, fba fees, other transaction fees, promotional rebates.
    expect(events).toHaveLength(6);
    const byType = Object.fromEntries(events.map((e) => [e.eventType, Number(e.amount)]));
    expect(byType.PRODUCT_REVENUE).toBeCloseTo(29.99, 2);
    expect(byType.TAX).toBeCloseTo(1.5, 2);
    expect(byType.REFERRAL_FEE).toBeCloseTo(-4.5, 2);
    expect(byType.FBA_FULFILLMENT_FEE).toBeCloseTo(-3.25, 2);
    expect(byType.OTHER_FEE).toBeCloseTo(-0.3, 2);
    expect(byType.PROMOTION).toBeCloseTo(-2.0, 2);

    // Re-uploading the exact same report must not duplicate any of the 6 events.
    const batch2 = await startImport({ filename: "transaction-report.csv", buffer, reportType: "FINANCE" }, ownerId, "OWNER");
    const row2 = await prisma.importedRow.findFirstOrThrow({ where: { importBatchId: batch2.id } });
    expect(row2.status).toBe("DUPLICATE");
    await commitFinanceBatch(batch2.id, ownerId, "OWNER");
    const eventsAfterReimport = await prisma.saleFinancialEvent.findMany({ where: { productId: product.id } });
    expect(eventsAfterReimport).toHaveLength(6);
  });
});
