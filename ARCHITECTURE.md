# KAWKAB OS — Standing Architectural Conventions

This file holds the conventions that must survive across every phase, established now precisely so Phase 1 and beyond inherit them instead of each module reinventing its own version. See `KAWKAB-OS-Architecture-Review.md` and `KAWKAB-OS-Phase0-Implementation-Plan.md` for the full reasoning; this file is the short, standing reference.

## 1. The missing-cost invariant (non-negotiable)

**No calculation may substitute 0 for a missing input.** It must propagate `isComplete = false` and report what was excluded and why.

- Any computed figure that could be affected by missing data is returned as `CompletenessAware<T>` (`lib/types.ts`), never a bare number.
- Any stored row that could be affected by missing data carries `CompletenessStatus` (`COMPLETE` / `INCOMPLETE`), a field distinct from verification and matching status (see below).
- A UI never shows a computed figure without checking `isComplete` first. An incomplete figure renders as "incomplete," never as a suspiciously-good number.

This has no exceptions. It is the first thing every future module's code review is checked against.

## 2. Three independent status dimensions, not one

A record's state has three separable questions, each with its own enum:

| Dimension | Enum | Values | Question it answers |
|---|---|---|---|
| Verification | `VerificationStatus` | `NEEDS_REVIEW`, `VERIFIED`, `REJECTED` | Has a human confirmed this is correct? |
| Completeness | `CompletenessStatus` | `COMPLETE`, `INCOMPLETE` | Is all required data present? |
| Matching | `MatchStatus` | `NOT_APPLICABLE`, `UNMATCHED`, `MATCHED` | Does this reconcile against another source? |

A record can be `VERIFIED` + `COMPLETE` + `MATCHED` simultaneously, or any other combination — that's why these are three fields, not one conflated `DataStatus` enum. `NOT_APPLICABLE` is `MatchStatus`'s default, not `UNMATCHED`, so a row that was never a reconciliation candidate (most rows, until SP-API reconciliation in Phase 4) doesn't read as "failed to match."

## 3. Provenance

Every table that could hold data from more than one source carries:

- `source: TransactionSource` (`MANUAL | AI_EXTRACTED | SP_API | SYSTEM`)
- a nullable `confidence` (Decimal) on any field an AI could populate
- `verifiedByUserId` / `verifiedAt` on anything needing human sign-off

**Amazon is the source of truth for Amazon-originated operational numbers** (units sold, Amazon fees, settlement amounts, FBA inventory) whenever Amazon data is available. **KAWKAB is the source of truth for private business costs** — supplier invoices, cartons, local shipping, prep, and anything Amazon has no visibility into. The reconciliation layer (Phase 4+) joins these; neither overwrites the other silently.

## 4. Audit trail

Every mutating service function writes exactly one `AuditLog` row **inside the same transaction** as the mutation. `AuditLog` rows are never updated or deleted — there is no code path that does it, not just a rule against doing it. `oldValue`/`newValue` are `Json`, so structured objects (a corrected batch allocation, an AI proposal, a reconciliation diff) are stored as real structure, not a flattened string.

## 5. Documents

One dedicated join table per entity type (`ProductDocument`, `SupplierDocument`, ...), never a polymorphic table. The Document Center's search is a union across all of them, extended — never redesigned — as each new join table is added. Any route that serves a file's bytes re-checks the same visibility rule the metadata path uses; a permission check on upload is not a permission check on read.

## 6. Real foreign keys, always — with one named exception

Every relationship is a real Postgres foreign key, never a free-form ID string standing in for one. The one deliberate exception: `AuditLog.entityType` / `entityId`, which must be able to point at any table in the system, and Postgres has no polymorphic foreign key. That is the only place this tradeoff is accepted.

## 7. Nothing is hard-deleted

Corrections are additive (new rows, reversing entries) with a mandatory reason and actor recorded, never edits to history. Status fields move between states (`active` → `archived`, etc.) instead of rows disappearing.

## 8. AI's authority is bounded by design, not convention

`AI_AGENT`'s permission set is enforced in `lib/permissions.ts` the same way every other role's is — empty until a later phase explicitly grants specific, narrow actions. AI may monitor, calculate, analyze, recommend, and draft. It may never spend money or take a critical external action without an explicit human approval step, and that boundary is a permission-matrix fact, not a prompt instruction.

## 9. Landed cost vs. net profit (Phase 1A)

**Acquisition landed cost** (purchase cost + supplier shipping + local shipping + prep + packaging + other attributable costs, allocated per unit) and **net profit after Amazon** (acquisition cost minus Amazon fees/revenue) are never the same number and never share a label. Nothing in this codebase calls anything "net profit" until Amazon fee/revenue data is real. `lib/landedCost.ts` computes the former only; the latter doesn't exist yet.

Every shared cost field that feeds a landed-cost calculation is nullable, and null is load-bearing: null means "not yet entered," a real number (including 0) means "confirmed." A landed cost calculation returns `INCOMPLETE`, never a guess, if any required field is null.

## 10. Identifier and cost history (Phase 1A)

`ProductIdentifier` and `Purchase`/`PurchaseItem` never overwrite history. A new ASIN supersedes the old one (`isCurrent: false`, `effectiveTo` set) rather than replacing it. A new purchase at a different price is its own permanent row, never a mutation of an earlier one — this is what makes Phase 1B's FIFO consumption possible without a schema migration.

## 11. Restricted is a status, not a verdict (Phase 1A)

`ProductEligibility.status = RESTRICTED` never removes a product from view or moves it to a rejected state. The fields on `ProductEligibility` exist specifically to track a path back to eligibility — a brand relationship, a qualifying supplier invoice — and KAWKAB may note that a path looks suitable for an application, but never asserts that Amazon will approve it. Approval belongs to Amazon alone.

## 12. FIFO consumption and signed reversals (Phase 1B)

Inventory consumption follows oldest-batch-first FIFO against `PurchaseItem` rows, freezing both `unitPurchaseCost` (always known) and `landedUnitCost` (only if complete at that moment) permanently onto each `BatchConsumption` row. A later correction to the originating `Purchase`'s cost fields never changes an already-posted `BatchConsumption` — that is historical COGS locking, and it holds because the code recomputes nothing on read, not because of a rule asking it not to.

Reversals are **signed, negative `BatchConsumption` rows** linked to a `REVERSAL`-type `ConsumptionEvent` — never edits to the original rows, and never a second row that a read path has to remember to filter out. This is a deliberate departure from the pattern the old prototype used for cost corrections (leave the original untouched, add a new row, rely on every future read to exclude the superseded one) — that exact pattern was the cause of a real double-counting bug found during the Phase 0 codebase review. A plain `SUM(quantity)` over signed rows is correct by construction, everywhere, with nothing to forget.

Quantity on hand, per product, is always computed from `PurchaseItem.quantity − SUM(BatchConsumption.quantity)`, never stored as a running counter — the same reasoning as Decision Box and Data Health being computed rather than cached.

## 13. Invoice number vs. invoice document (Phase 1C)

These are two different facts about a Purchase, tracked independently, and conflating them was an explicit correction:

- **Invoice/order number** (`Purchase.invoiceNumber`) — a required string, always present the moment a Purchase exists. A Purchase cannot be created without it.
- **Invoice document** — a `PurchaseDocument`-linked file, optional at creation time. Its absence never blocks creating the Purchase.

`Purchase.completenessStatus` depends on **both**: every shared cost field entered (the original rule) **and** at least one document attached (added in Phase 1C). A Purchase with perfect cost data and no invoice on file is `INCOMPLETE`, and `getPurchaseCompletenessReasons()` reports "Missing invoice document" as its own specific reason, distinct from a missing cost field, so the UI and Action Center can treat it as the higher-severity item it is. `recomputePurchaseCompleteness()` runs inside the same transaction as a document upload, so completeness never goes stale waiting for a separate step to notice the file arrived.

## 14. Every module reuses the same foundation, never a parallel one (Phase 2)

Boxes' `BoxMovement` is a leaner sibling of the FIFO ledger, not a rebuild — same signed-quantity-nets-under-SUM() principle. Shipments doesn't have its own inventory-tracking logic at all; it calls directly into the same tx-scoped FIFO and Box-movement functions Purchases and manual consumption already use, so a shipment's product and box consumption are atomic with each other in one transaction. Brand CRM's `Product.brandId` is a real FK link alongside the free-text `Product.brand` field, exactly as anticipated when that field was first built. Finance and Reports compute everything from the same service functions (`listInventorySummary`, `listPurchases`, `getFinanceSummary`) that the operational pages already call — neither has its own query path. This is a standing rule for every future module: extend the existing foundation, never stand up a second one beside it.

## 15. Settings never fabricates connection status (Phase 2)

`getIntegrationReadiness()` reports Amazon SP-API as not connected unconditionally, because no integration code exists yet — this is not a toggle a future developer could accidentally flip to "connected" without real OAuth work behind it. Storage readiness is read from actual environment configuration (`STORAGE_PROVIDER`, `AWS_S3_BUCKET`), never assumed. No credential ever appears in source code; only environment variable names are referenced.

## 16. Real Data: revenue source-of-truth (Sales / Amazon import)

A SaleItem's revenue comes from its PRODUCT_REVENUE SaleFinancialEvent(s) whenever any exist — finance/settlement data supersedes the sales-report price once it arrives, since it's Amazon's own authoritative settled figure. `SaleItem.lineItemSubtotal` (preferred) or `unitSellingPrice × quantity` (fallback) is used **only** when no PRODUCT_REVENUE event exists yet. The two are never summed — see `lib/finance.ts`'s `computeSaleItemProfit` and `tests/salesImport.test.ts`'s "revenue source-of-truth rule" test, which verifies this directly against a real before/after state rather than by inspection alone.

## 17. Real Data: completeness for sales/finance (Sales / Amazon import)

A SaleItem's profit is `COMPLETE` only if revenue is known (by either source above), at least one fee-type event (`REFERRAL_FEE`, `FBA_FULFILLMENT_FEE`, or `OTHER_FEE`) exists, and every contributing `BatchConsumption` row was itself `COMPLETE` at consumption time. Refunds/credits/reimbursements/promotions/tax/adjustments are legitimately optional — their absence is a real "$0 contribution," not missing data, and does not mark the item incomplete. COGS is never recomputed independently of FIFO; it is read directly from `BatchConsumption.landedUnitCost`/`unitPurchaseCost`, frozen at the moment `AMAZON_SALE` consumption happened.

## 18. Real Data: duplicate protection has two independent layers (Sales / Amazon import)

`ImportedRow` catches a duplicate raw row before any matching or consumption logic runs, via `@@unique([reportType, sourceRowKey])` — scoped by report type because SALES/FINANCE/INVENTORY are different Amazon ID systems with no proven shared namespace. `SaleItem.externalLineItemId` and `SaleFinancialEvent.importFingerprint` are a second, independent guard at the exact point a duplicate would cause real harm (double inventory consumption, a duplicated financial event) — this matters specifically because a future SP-API sync may create `SaleItem`/`SaleFinancialEvent` rows through a path that doesn't go through `ImportedRow` at all, in which case this second layer is the only protection left standing.

## 19. Real Data: reused, not parallel, FIFO (Sales / Amazon import)

Committing a `SaleItem` calls the exact same `consumeInventoryWithinTx` function Purchases, manual consumption, and Shipments already call — a new `AMAZON_SALE` `ConsumptionEventType` and a new `saleItemId` field on `ConsumptionEvent` (mirroring the existing `shipmentId` field exactly) were the only changes made to `lib/fifo.ts`. No second inventory-tracking mechanism exists for Amazon sales.
