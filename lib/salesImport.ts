// lib/salesImport.ts
//
// The upload -> parse -> dedupe -> match -> review -> commit pipeline,
// deliberately kept as separate, independently-callable steps rather than
// one opaque action — each step's result is visible before the next one
// runs. Nothing is guessed (product matching is exact-identifier-only,
// see lib/productMatching.ts) and nothing consumes inventory until a row
// is explicitly committed — uploading or parsing a file never touches
// inventory by itself.
//
// Column-name mapping below (COLUMN_CANDIDATES) is a starting point, not
// a claim about Amazon's exact export format — this has not been run
// against a real Seller Central report. Extending the candidate lists is
// expected and safe; it doesn't change the pipeline's shape.

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { parseImportFile } from "./importParsers";
import { matchProductByIdentifiers } from "./productMatching";
import { consumeInventoryWithinTx } from "./fifo";
import { createFinancialEvent } from "./financialEvents";
import { writeAuditLog } from "./audit";
import { ImportReportType, FinancialEventType } from "@prisma/client";

const COLUMN_CANDIDATES = {
  sku: ["sku", "seller-sku", "merchant-sku"],
  asin: ["asin", "asin1"],
  orderId: ["order-id", "amazon-order-id", "order id"],
  orderItemId: ["order-item-id", "amazon-order-item-id"],
  quantity: ["quantity", "quantity-purchased", "qty"],
  saleDate: ["purchase-date", "sale-date", "date"],
  itemPrice: ["item-price", "unit-price", "price"],
  itemPriceSubtotal: ["item-price-subtotal", "product-sales"],
  amount: ["amount", "total"],
  amountType: ["amount-type", "amount-description", "transaction-type", "type"],
  eventDate: ["date", "posted-date", "posted-date-time"],
  transactionId: ["transaction-id", "event-id"],
  currency: ["currency"],
};

// Amazon's Payments -> Reports Repository -> Transaction report is a wide,
// one-row-per-transaction ledger with a SEPARATE column per fee/revenue
// type — not the one-amount-plus-one-type-per-row shape COLUMN_CANDIDATES.
// amount/amountType above assumes. A row from that report is checked
// against every entry here; each column that's actually present (even a
// real "0") becomes its own SaleFinancialEvent, so nothing on a wide row
// is silently dropped in favor of picking just one column. See
// commitFinanceBatch below for how this and the narrow single-amount
// shape coexist without double-counting the same row.
const FEE_COLUMN_CANDIDATES: Array<{ type: FinancialEventType; candidates: string[] }> = [
  { type: "PRODUCT_REVENUE", candidates: ["product sales", "product-sales"] },
  { type: "REFERRAL_FEE", candidates: ["selling fees", "selling-fees", "referral fee", "referral-fee", "referral fees"] },
  { type: "FBA_FULFILLMENT_FEE", candidates: ["fba fees", "fba-fees", "fba per unit fulfillment fee", "fulfillment fee", "fulfillment fees"] },
  { type: "OTHER_FEE", candidates: ["other transaction fees", "other-transaction-fees", "regulatory fee", "other"] },
  { type: "PROMOTION", candidates: ["promotional rebates", "promotional-rebates"] },
  { type: "REIMBURSEMENT", candidates: ["reimbursement", "reimbursements"] },
  {
    type: "TAX",
    candidates: [
      "product sales tax",
      "shipping credits tax",
      "gift wrap credits tax",
      "giftwrap credits tax",
      "marketplace withheld tax",
      "promotional rebates tax",
      "tax on regulatory fee",
    ],
  },
];

/**
 * Normalizes a header for matching: lowercase, trimmed, with spaces,
 * underscores, and hyphens all collapsed away. This is what lets
 * "Order ID", "order-id", "order_id", and "ORDER ID" all resolve to the
 * same candidate — real Seller Central exports are not consistent about
 * casing/separators between report types, and this normalization has to
 * hold regardless of which variant a given file uses.
 */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[\s_-]+/g, "");
}

function findColumnValue(row: Record<string, unknown>, candidates: string[]): unknown {
  const normalizedKeys = Object.fromEntries(Object.keys(row).map((k) => [normalizeHeader(k), k]));
  for (const candidate of candidates) {
    const actualKey = normalizedKeys[normalizeHeader(candidate)];
    if (actualKey !== undefined && row[actualKey] !== undefined && row[actualKey] !== null && row[actualKey] !== "") {
      return row[actualKey];
    }
  }
  return undefined;
}

function buildSourceRowKey(row: Record<string, unknown>): string | undefined {
  const orderId = findColumnValue(row, COLUMN_CANDIDATES.orderId);
  const orderItemId = findColumnValue(row, COLUMN_CANDIDATES.orderItemId);
  const sku = findColumnValue(row, COLUMN_CANDIDATES.sku);
  if (orderId && orderItemId) return `${orderId}:${orderItemId}`;
  if (orderId && sku) return `${orderId}:${sku}`;
  // No stable key available — the row is still imported and processed,
  // it simply isn't protected by the database-level duplicate constraint.
  return undefined;
}

async function getImportBatchRowCounts(importBatchId: string) {
  const rows = await prisma.importedRow.findMany({ where: { importBatchId }, select: { status: true } });
  return {
    matched: rows.filter((r) => r.status === "MATCHED" || r.status === "COMMITTED").length,
    unmatched: rows.filter((r) => r.status === "UNMATCHED").length,
    duplicate: rows.filter((r) => r.status === "DUPLICATE").length,
    error: rows.filter((r) => r.status === "ERROR").length,
  };
}

export interface StartImportInput {
  filename: string;
  buffer: Buffer;
  reportType: ImportReportType;
}

/**
 * Step 1: parse the file and create one ImportBatch + one ImportedRow per
 * parsed row. Duplicate rows (matched against the (reportType,
 * sourceRowKey) database constraint) are flagged immediately and never
 * proceed further. Nothing is matched or committed here.
 */
export async function startImport(input: StartImportInput, actingUserId: string, role: Role) {
  requirePermission(role, "manage_imports");

  const parsed = parseImportFile(input.buffer, input.filename);

  return prisma.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          reportType: input.reportType,
          status: "PROCESSING",
          filename: input.filename,
          originalRowCount: parsed.rows.length,
          source: "FILE_IMPORT",
          createdByUserId: actingUserId,
        },
      });

      for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i];
        const sourceRowKey = buildSourceRowKey(row);

        let isDuplicate = false;
        if (sourceRowKey) {
          const existing = await tx.importedRow.findUnique({
            where: { reportType_sourceRowKey: { reportType: input.reportType, sourceRowKey } },
          });
          isDuplicate = !!existing;
        }

        await tx.importedRow.create({
          data: {
            importBatchId: batch.id,
            reportType: input.reportType,
            rowNumber: i + 1,
            rawData: row as object,
            status: isDuplicate ? "DUPLICATE" : "PENDING",
            // A duplicate row is still recorded in full (rawData, status)
            // for visibility, but must NOT carry the same sourceRowKey as
            // the original — that's exactly the (reportType, sourceRowKey)
            // pair the unique constraint is protecting, and Postgres treats
            // every NULL as distinct under a unique index, so this is safe.
            sourceRowKey: isDuplicate ? null : sourceRowKey,
          },
        });
      }

      const counts = await getImportBatchRowCounts(batch.id);
      await tx.importBatch.update({ where: { id: batch.id }, data: { duplicateRowCount: counts.duplicate } });

      await writeAuditLog(tx, {
        userId: actingUserId,
        action: "CREATE",
        entityType: "ImportBatch",
        entityId: batch.id,
        newValue: { filename: input.filename, reportType: input.reportType, rowCount: parsed.rows.length, duplicates: counts.duplicate },
        source: "FILE_IMPORT",
      });

      return batch;
    },
    { timeout: 60000 } // a real report file can be hundreds of rows; the default transaction timeout is too tight
  );
}

/**
 * Step 2: attempt product matching for every PENDING row. Exact-identifier
 * matching only (see lib/productMatching.ts) — a row that can't be
 * matched this way is left UNMATCHED and visible, never guessed.
 */
export async function matchImportBatch(importBatchId: string, actingUserId: string, role: Role) {
  requirePermission(role, "manage_imports");

  const rows = await prisma.importedRow.findMany({ where: { importBatchId, status: "PENDING" } });

  let matched = 0;
  let unmatched = 0;

  for (const row of rows) {
    const raw = row.rawData as Record<string, unknown>;
    const sku = findColumnValue(raw, COLUMN_CANDIDATES.sku);
    const asin = findColumnValue(raw, COLUMN_CANDIDATES.asin);

    const productId = await matchProductByIdentifiers([
      { type: "INTERNAL_SKU", value: sku ? String(sku) : "" },
      { type: "ASIN", value: asin ? String(asin) : "" },
    ]);

    if (productId) {
      await prisma.importedRow.update({ where: { id: row.id }, data: { status: "MATCHED", matchedProductId: productId } });
      matched++;
    } else {
      await prisma.importedRow.update({ where: { id: row.id }, data: { status: "UNMATCHED" } });
      unmatched++;
    }
  }

  const counts = await getImportBatchRowCounts(importBatchId);
  await prisma.importBatch.update({
    where: { id: importBatchId },
    data: {
      matchedRowCount: counts.matched,
      unmatchedRowCount: counts.unmatched,
      status: counts.unmatched > 0 ? "PARTIALLY_PROCESSED" : "PROCESSING",
    },
  });

  return { matched, unmatched };
}

/** Lets the Owner/Operator manually resolve a row the automatic matcher couldn't. */
export async function resolveUnmatchedRow(importedRowId: string, productId: string, actingUserId: string, role: Role) {
  requirePermission(role, "manage_imports");

  return prisma.$transaction(async (tx) => {
    const row = await tx.importedRow.update({
      where: { id: importedRowId },
      data: { status: "MATCHED", matchedProductId: productId },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "UPDATE",
      entityType: "ImportedRow",
      entityId: importedRowId,
      fieldChanged: "matchedProductId",
      newValue: { productId, resolvedManually: true },
      source: "MANUAL",
    });
    return row;
  });
}

/**
 * Step 3 (SALES report type): for every MATCHED row, reuses a Sale header
 * by externalOrderId when one already exists for this order, creates the
 * SaleItem, and commits it — consuming inventory exactly once. A failure
 * on one row (insufficient inventory, missing quantity) marks that row
 * ERROR and moves on; it never blocks the other rows in the same batch.
 */
export async function commitSalesBatch(importBatchId: string, actingUserId: string, role: Role) {
  requirePermission(role, "manage_imports");

  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: importBatchId } });
  if (batch.reportType !== "SALES") {
    throw new Error(`commitSalesBatch was called on a ${batch.reportType} batch — only SALES batches create Sale records.`);
  }

  const rows = await prisma.importedRow.findMany({ where: { importBatchId, status: "MATCHED" } });
  let committed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const raw = row.rawData as Record<string, unknown>;
      const externalOrderId = findColumnValue(raw, COLUMN_CANDIDATES.orderId);
      const externalLineItemId = findColumnValue(raw, COLUMN_CANDIDATES.orderItemId);
      const quantity = Number(findColumnValue(raw, COLUMN_CANDIDATES.quantity));
      const saleDateRaw = findColumnValue(raw, COLUMN_CANDIDATES.saleDate);
      const priceRaw = findColumnValue(raw, COLUMN_CANDIDATES.itemPrice);
      const subtotalRaw = findColumnValue(raw, COLUMN_CANDIDATES.itemPriceSubtotal);

      if (!quantity || quantity <= 0 || isNaN(quantity)) throw new Error("Missing or invalid quantity.");
      const saleDate = saleDateRaw ? new Date(String(saleDateRaw)) : null;
      if (!saleDate || isNaN(saleDate.getTime())) throw new Error("Missing or invalid sale date.");

      // unitSellingPrice/lineItemSubtotal are both nullable — never
      // invented. If the source gave neither, the SaleItem still commits
      // (the sale/inventory fact is real even if the price wasn't in this
      // particular row), but nothing here fabricates a price.
      const unitSellingPrice = priceRaw !== undefined ? Number(priceRaw) : undefined;
      const lineItemSubtotal = subtotalRaw !== undefined ? Number(subtotalRaw) : undefined;

      await prisma.$transaction(async (tx) => {
        let sale = externalOrderId
          ? await tx.sale.findUnique({ where: { externalOrderId: String(externalOrderId) } })
          : null;

        if (!sale) {
          sale = await tx.sale.create({
            data: {
              saleDate,
              importBatchId,
              externalOrderId: externalOrderId ? String(externalOrderId) : undefined,
              source: "FILE_IMPORT",
              createdByUserId: actingUserId,
            },
          });
        }

        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: row.matchedProductId!,
            quantity,
            unitSellingPrice,
            lineItemSubtotal,
            externalLineItemId: externalLineItemId ? String(externalLineItemId) : undefined,
            importedRowId: row.id,
          },
        });

        await consumeInventoryWithinTx(
          tx,
          {
            productId: row.matchedProductId!,
            type: "AMAZON_SALE",
            quantity,
            eventDate: saleDate,
            saleItemId: saleItem.id,
            notes: `Imported from ${batch.filename}`,
          },
          actingUserId
        );

        await tx.importedRow.update({ where: { id: row.id }, data: { status: "COMMITTED" } });

        await writeAuditLog(tx, {
          userId: actingUserId,
          action: "CREATE",
          entityType: "SaleItem",
          entityId: saleItem.id,
          newValue: { productId: row.matchedProductId, quantity, saleId: sale.id },
          source: "FILE_IMPORT",
        });
      });

      committed++;
    } catch (e) {
      await prisma.importedRow.update({ where: { id: row.id }, data: { status: "ERROR", errorMessage: (e as Error).message } });
      failed++;
    }
  }

  const counts = await getImportBatchRowCounts(importBatchId);
  await prisma.importBatch.update({
    where: { id: importBatchId },
    data: { errorRowCount: counts.error, status: failed > 0 ? "PARTIALLY_PROCESSED" : "PROCESSED" },
  });

  return { committed, failed };
}

/**
 * Step 3 (FINANCE report type): creates a SaleFinancialEvent per row.
 * Reconciliation to a Sale/SaleItem is attempted but never required —
 * this is exactly the "finance report may arrive before the sales
 * report" case, and nothing here blocks or discards a row over it.
 */
export async function commitFinanceBatch(importBatchId: string, actingUserId: string, role: Role) {
  requirePermission(role, "manage_imports");

  const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: importBatchId } });
  if (batch.reportType !== "FINANCE") {
    throw new Error(`commitFinanceBatch was called on a ${batch.reportType} batch.`);
  }

  // Finance rows don't require a prior MATCHED step — matching is
  // optional/best-effort for finance data (see createFinancialEvent).
  const rows = await prisma.importedRow.findMany({ where: { importBatchId, status: { in: ["PENDING", "MATCHED"] } } });
  let created = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const raw = row.rawData as Record<string, unknown>;

      const eventDateRaw = findColumnValue(raw, COLUMN_CANDIDATES.eventDate);
      const eventDate = eventDateRaw ? new Date(String(eventDateRaw)) : new Date();
      if (isNaN(eventDate.getTime())) throw new Error("Missing or invalid event date.");

      const externalOrderId = findColumnValue(raw, COLUMN_CANDIDATES.orderId);
      const externalLineItemId = findColumnValue(raw, COLUMN_CANDIDATES.orderItemId);
      const externalEventId = findColumnValue(raw, COLUMN_CANDIDATES.transactionId);
      const currency = String(findColumnValue(raw, COLUMN_CANDIDATES.currency) ?? "USD");

      const shared = {
        currency,
        eventDate,
        externalEventId: externalEventId ? String(externalEventId) : undefined,
        externalOrderId: externalOrderId ? String(externalOrderId) : undefined,
        externalLineItemId: externalLineItemId ? String(externalLineItemId) : undefined,
        productId: row.matchedProductId,
        importBatchId,
        importedRowId: row.id,
        notes: `Imported from ${batch.filename}`,
      };

      // Wide shape first — Amazon's own Transaction report (Payments ->
      // Reports Repository) puts revenue and every fee type in separate
      // columns on one row. Every column actually present becomes its own
      // event, keyed `${row.id}:${eventType}` so multiple events from the
      // same row each get a distinct, stable duplicate-protection
      // fingerprint instead of colliding on the row id alone.
      let wideEventsCreated = 0;
      for (const { type, candidates } of FEE_COLUMN_CANDIDATES) {
        const valueRaw = findColumnValue(raw, candidates);
        if (valueRaw === undefined) continue;
        const amount = Number(valueRaw);
        if (isNaN(amount)) continue;
        await createFinancialEvent(
          { eventType: type, amount, importFingerprint: `${row.id}:${type}`, ...shared },
          actingUserId,
          role
        );
        wideEventsCreated++;
      }

      if (wideEventsCreated === 0) {
        // Narrow shape fallback — one amount + one type column per row.
        const amountRaw = findColumnValue(raw, COLUMN_CANDIDATES.amount);
        if (amountRaw === undefined) throw new Error("Missing amount.");
        const amount = Number(amountRaw);
        if (isNaN(amount)) throw new Error("Amount is not a valid number.");

        const eventTypeRaw = String(findColumnValue(raw, COLUMN_CANDIDATES.amountType) ?? "OTHER")
          .toUpperCase()
          .replace(/[\s-]+/g, "_");
        const eventType = (Object.values(FinancialEventType) as string[]).includes(eventTypeRaw)
          ? (eventTypeRaw as FinancialEventType)
          : "OTHER";

        await createFinancialEvent(
          { eventType, amount, importFingerprint: row.id, ...shared },
          actingUserId,
          role
        );
      }

      await prisma.importedRow.update({ where: { id: row.id }, data: { status: "COMMITTED" } });
      created++;
    } catch (e) {
      await prisma.importedRow.update({ where: { id: row.id }, data: { status: "ERROR", errorMessage: (e as Error).message } });
      failed++;
    }
  }

  const counts = await getImportBatchRowCounts(importBatchId);
  await prisma.importBatch.update({
    where: { id: importBatchId },
    data: { errorRowCount: counts.error, status: failed > 0 ? "PARTIALLY_PROCESSED" : "PROCESSED" },
  });

  return { created, failed };
}

export async function listImportBatches() {
  return prisma.importBatch.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getImportBatch(importBatchId: string) {
  const batch = await prisma.importBatch.findUniqueOrThrow({
    where: { id: importBatchId },
    include: { importedRows: { include: { matchedProduct: true }, orderBy: { rowNumber: "asc" } } },
  });
  return batch;
}
