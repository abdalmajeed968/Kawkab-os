// tests/audit.test.ts
//
// The structural test below (module exports) needs no database and can
// run anywhere. Everything else is a REAL integration test against a live
// Postgres instance — run with `DATABASE_URL=<test-db-url> npm test`.
// I attempted to run this suite in the build sandbox; see the Phase 0
// build report for the exact, unedited result — this repository has not
// been proven to pass these by execution in that environment.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as auditModule from "../lib/audit";
import { prisma } from "../lib/prisma";
import { writeAuditLog, getRecentActivity } from "../lib/audit";

describe("AuditLog is structurally append-only", () => {
  it("the audit module exports no function capable of updating or deleting a row", () => {
    // This is the actual guarantee: immutability holds because the
    // capability to mutate history was never written, not because a
    // comment says not to use it. If this test ever fails, someone added
    // exactly the function this architecture depends on not existing.
    const exportNames = Object.keys(auditModule);
    const suspicious = exportNames.filter((n) => /update|delete|edit|remove/i.test(n));
    expect(suspicious).toEqual([]);
  });
});

describe("writeAuditLog — real database", () => {
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { name: "Test Owner", email: `audit-test-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OWNER" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { userId } }); // test cleanup only — not app code
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("creates exactly one row with the given fields, inside the caller's transaction", async () => {
    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        userId,
        action: "CREATE",
        entityType: "BusinessRecord",
        entityId: "test-entity-id",
        fieldChanged: "name",
        newValue: { name: "Test record" },
        source: "MANUAL",
      });
    });

    const rows = await prisma.auditLog.findMany({ where: { entityId: "test-entity-id" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("CREATE");
    expect(rows[0].newValue).toEqual({ name: "Test record" });
  });

  it("stores structured objects in oldValue/newValue, not flattened strings", async () => {
    const structuredOld = { allocations: [{ batchId: "b1", quantity: 5, unitCost: 4.5 }] };
    const structuredNew = { allocations: [{ batchId: "b2", quantity: 5, unitCost: 6.0 }] };

    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, {
        userId,
        action: "CORRECT",
        entityType: "OrderItem",
        entityId: "test-order-item-id",
        fieldChanged: "cogs_allocation",
        oldValue: structuredOld,
        newValue: structuredNew,
        source: "MANUAL",
      });
    });

    const row = await prisma.auditLog.findFirstOrThrow({ where: { entityId: "test-order-item-id" } });
    expect(row.oldValue).toEqual(structuredOld);
    expect(row.newValue).toEqual(structuredNew);
  });

  it("getRecentActivity scopes an OPERATOR to only their own actions", async () => {
    const operator = await prisma.user.create({
      data: { name: "Test Operator", email: `operator-${Date.now()}@kawkab.local`, passwordHash: "x", role: "OPERATOR" },
    });

    await prisma.$transaction(async (tx) => {
      await writeAuditLog(tx, { userId, action: "LOGIN", entityType: "User", entityId: userId });
      await writeAuditLog(tx, { userId: operator.id, action: "LOGIN", entityType: "User", entityId: operator.id });
    });

    const ownerView = await getRecentActivity("OWNER", userId, 50);
    const operatorView = await getRecentActivity("OPERATOR", operator.id, 50);

    expect(ownerView.some((r) => r.userId === operator.id)).toBe(true); // Owner sees everyone
    expect(operatorView.every((r) => r.userId === operator.id)).toBe(true); // Operator sees only themself

    await prisma.auditLog.deleteMany({ where: { userId: operator.id } });
    await prisma.user.delete({ where: { id: operator.id } });
  });
});
