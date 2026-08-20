// tests/fifo.test.ts
//
// REAL integration tests against a live Postgres instance — run with
// `DATABASE_URL=<test-db-url> npm test`. This is the most important test
// file in Phase 1B: the actual verification that FIFO consumption order,
// cost freezing (historical COGS locking), and signed-quantity reversal
// all hold against real data, not just read correctly on a static trace.
// See the Phase 1B build report for whether this suite was actually
// executed and what happened when it was attempted.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/prisma";
import { createProduct } from "../lib/products";
import { createPurchase, correctPurchase } from "../lib/purchases";
import { createSupplier } from "../lib/suppliers";
import { recordConsumptionEvent, reverseConsumptionEvent, InsufficientInventoryError } from "../lib/fifo";
import { getAvailableBatches, getInventoryOnHand } from "../lib/inventory";
import { PermissionError } from "../lib/permissions";

describe("FIFO consumption and historical COGS locking", () => {
  let ownerId: string;
  let operatorId: string;
  let aiAgentId: string;
  let supplierId: string;

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: { name: "FIFO Test Owner", email: `fifo-owner-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OWNER" },
    });
    ownerId = owner.id;
    const operator = await prisma.user.create({
      data: { name: "FIFO Test Operator", email: `fifo-operator-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OPERATOR" },
    });
    operatorId = operator.id;
    const aiAgent = await prisma.user.create({
      data: { name: "FIFO Test AI Agent", email: `fifo-ai-${Date.now()}@kawkab.local`, passwordHash: "x", role: "AI_AGENT" },
    });
    aiAgentId = aiAgent.id;
    const supplier = await createSupplier({ name: "FIFO Test Supplier" }, ownerId, "OWNER");
    supplierId = supplier.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** 20 units total across two batches: 10 @ $5, then 10 @ $7 — the same worked example the architecture review used to verify the old prototype's FIFO, reused here deliberately. */
  async function makeProductWithTwoBatches() {
    const product = await createProduct({ name: `FIFO Product ${Date.now()}-${Math.random()}` }, ownerId, "OWNER");
    await createPurchase(
      {
        supplierId,
        purchaseDate: new Date("2026-01-01"), invoiceNumber: "TEST-INVOICE",
        invoiceTotal: 50,
        supplierShipping: 0,
        localShipping: 0,
        prepCost: 0,
        packagingCost: 0,
        tax: 0,
        discount: 0,
        otherCost: 0,
        items: [{ productId: product.id, quantity: 10, lineItemCost: 50 }],
      },
      ownerId,
      "OWNER"
    );
    await createPurchase(
      {
        supplierId,
        purchaseDate: new Date("2026-02-01"), invoiceNumber: "TEST-INVOICE",
        invoiceTotal: 70,
        supplierShipping: 0,
        localShipping: 0,
        prepCost: 0,
        packagingCost: 0,
        tax: 0,
        discount: 0,
        otherCost: 0,
        items: [{ productId: product.id, quantity: 10, lineItemCost: 70 }],
      },
      ownerId,
      "OWNER"
    );
    return product;
  }

  it("consumes the oldest batch first", async () => {
    const product = await makeProductWithTwoBatches();
    const { consumptions } = await recordConsumptionEvent(
      { productId: product.id, type: "MANUAL_SALE", quantity: 5, eventDate: new Date() },
      ownerId,
      "OWNER"
    );
    expect(consumptions).toHaveLength(1);
    expect(Number(consumptions[0].unitPurchaseCost)).toBe(5); // batch 1's cost, not batch 2's $7
    expect(await getInventoryOnHand(product.id)).toBe(15);
  });

  it("splits consumption across batches in FIFO order when the first batch isn't enough", async () => {
    const product = await makeProductWithTwoBatches();
    const { consumptions } = await recordConsumptionEvent(
      { productId: product.id, type: "MANUAL_SALE", quantity: 12, eventDate: new Date() },
      ownerId,
      "OWNER"
    );
    expect(consumptions).toHaveLength(2);
    expect(consumptions[0].quantity).toBe(10); // all of batch 1
    expect(Number(consumptions[0].unitPurchaseCost)).toBe(5);
    expect(consumptions[1].quantity).toBe(2); // 2 units from batch 2
    expect(Number(consumptions[1].unitPurchaseCost)).toBe(7);
  });

  it("throws InsufficientInventoryError rather than partially consuming or guessing", async () => {
    const product = await makeProductWithTwoBatches();
    await expect(
      recordConsumptionEvent({ productId: product.id, type: "MANUAL_SALE", quantity: 999, eventDate: new Date() }, ownerId, "OWNER")
    ).rejects.toThrow(InsufficientInventoryError);
    expect(await getInventoryOnHand(product.id)).toBe(20); // nothing written on failure
  });

  it("freezes unit cost at consumption time — a later purchase correction never changes an already-posted row", async () => {
    const product = await createProduct({ name: `Locking Test ${Date.now()}` }, ownerId, "OWNER");
    const purchase = await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(), invoiceNumber: "TEST-INVOICE",
        invoiceTotal: 100,
        supplierShipping: 10,
        localShipping: 0,
        prepCost: 0,
        packagingCost: 0,
        tax: 0,
        discount: 0,
        otherCost: 0,
        items: [{ productId: product.id, quantity: 10, lineItemCost: 100 }],
      },
      ownerId,
      "OWNER"
    );

    const { consumptions } = await recordConsumptionEvent(
      { productId: product.id, type: "MANUAL_SALE", quantity: 5, eventDate: new Date() },
      ownerId,
      "OWNER"
    );
    const originalLandedCost = Number(consumptions[0].landedUnitCost);
    expect(originalLandedCost).toBeCloseTo(11, 4); // (100 + 10) / 10

    await correctPurchase(purchase.id, { supplierShipping: 50, reason: "test correction after consumption" }, ownerId, "OWNER");

    const row = await prisma.batchConsumption.findUniqueOrThrow({ where: { id: consumptions[0].id } });
    expect(Number(row.landedUnitCost)).toBeCloseTo(originalLandedCost, 4);
    expect(Number(row.landedUnitCost)).not.toBeCloseTo(15, 4); // what it would be if it had recomputed: (100 + 50) / 10
  });

  it("marks consumption INCOMPLETE, never a guessed number, when landed cost is incomplete at consumption time", async () => {
    const product = await createProduct({ name: `Incomplete Consumption Test ${Date.now()}` }, ownerId, "OWNER");
    await createPurchase(
      {
        supplierId,
        purchaseDate: new Date(), invoiceNumber: "TEST-INVOICE",
        invoiceTotal: 40,
        // shared costs omitted — genuinely unknown
        items: [{ productId: product.id, quantity: 4, lineItemCost: 40 }],
      },
      ownerId,
      "OWNER"
    );

    const { consumptions } = await recordConsumptionEvent(
      { productId: product.id, type: "MANUAL_SALE", quantity: 2, eventDate: new Date() },
      ownerId,
      "OWNER"
    );
    expect(consumptions[0].costCompletenessStatus).toBe("INCOMPLETE");
    expect(consumptions[0].landedUnitCost).toBeNull();
    expect(Number(consumptions[0].unitPurchaseCost)).toBe(10); // always available, regardless of landed-cost completeness
  });

  it("reversal nets out under plain summation — inventory becomes available again", async () => {
    const product = await makeProductWithTwoBatches();
    const { event } = await recordConsumptionEvent(
      { productId: product.id, type: "MANUAL_SALE", quantity: 8, eventDate: new Date() },
      ownerId,
      "OWNER"
    );
    expect(await getInventoryOnHand(product.id)).toBe(12);

    await reverseConsumptionEvent(event.id, "Customer returned the order", ownerId, "OWNER");
    expect(await getInventoryOnHand(product.id)).toBe(20); // fully restored, no drift
  });

  it("a reversal cannot itself be reversed, and an event cannot be reversed twice", async () => {
    const product = await makeProductWithTwoBatches();
    const { event } = await recordConsumptionEvent(
      { productId: product.id, type: "MANUAL_SALE", quantity: 3, eventDate: new Date() },
      ownerId,
      "OWNER"
    );
    const reversal = await reverseConsumptionEvent(event.id, "test", ownerId, "OWNER");

    await expect(reverseConsumptionEvent(event.id, "again", ownerId, "OWNER")).rejects.toThrow(/already been reversed/);
    await expect(reverseConsumptionEvent(reversal.id, "test", ownerId, "OWNER")).rejects.toThrow(/cannot itself be reversed/);
  });

  it("reversal requires a reason", async () => {
    const product = await makeProductWithTwoBatches();
    const { event } = await recordConsumptionEvent(
      { productId: product.id, type: "MANUAL_SALE", quantity: 1, eventDate: new Date() },
      ownerId,
      "OWNER"
    );
    await expect(reverseConsumptionEvent(event.id, "", ownerId, "OWNER")).rejects.toThrow(/reason/);
  });

  it("every consumption and reversal writes a real audit entry", async () => {
    const product = await makeProductWithTwoBatches();
    const { event } = await recordConsumptionEvent(
      { productId: product.id, type: "MANUAL_SALE", quantity: 2, eventDate: new Date() },
      ownerId,
      "OWNER"
    );
    const createAudit = await prisma.auditLog.findFirst({
      where: { entityId: event.id, action: "CREATE", entityType: "ConsumptionEvent" },
    });
    expect(createAudit).not.toBeNull();

    await reverseConsumptionEvent(event.id, "audit check", ownerId, "OWNER");
    const correctAudit = await prisma.auditLog.findFirst({
      where: { entityId: event.id, action: "CORRECT", entityType: "ConsumptionEvent" },
    });
    expect(correctAudit).not.toBeNull();
  });

  it("RBAC: AI_AGENT cannot record consumption", async () => {
    const product = await makeProductWithTwoBatches();
    await expect(
      recordConsumptionEvent({ productId: product.id, type: "MANUAL_SALE", quantity: 1, eventDate: new Date() }, aiAgentId, "AI_AGENT")
    ).rejects.toThrow(PermissionError);
  });

  it("RBAC: OPERATOR can record consumption but not reverse it", async () => {
    const product = await makeProductWithTwoBatches();
    const { event } = await recordConsumptionEvent(
      { productId: product.id, type: "MANUAL_SALE", quantity: 1, eventDate: new Date() },
      operatorId,
      "OPERATOR"
    );
    expect(event.id).toBeTruthy();
    await expect(reverseConsumptionEvent(event.id, "test", operatorId, "OPERATOR")).rejects.toThrow(PermissionError);
  });

  it("getAvailableBatches returns batches in FIFO order — oldest purchase date first", async () => {
    const product = await makeProductWithTwoBatches();
    const batches = await getAvailableBatches(product.id);
    expect(batches).toHaveLength(2);
    expect(batches[0].purchaseDate.getTime()).toBeLessThan(batches[1].purchaseDate.getTime());
  });
});
