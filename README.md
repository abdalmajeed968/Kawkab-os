# KAWKAB OS

**Phase 0: BUILT, NOT YET VALIDATED BY EXECUTION.** See `/mnt/user-data/outputs/KAWKAB-OS-Phase0-Build-Report.md` (delivered alongside this code) for the full, unedited account of what could and couldn't be run in the environment this was built in, and why.

Canonical data foundation, audit trail, RBAC, documents infrastructure, source/provenance model, cost-completeness rules, SKU/ASIN/FNSKU/marketplace mapping design, design token system, app shell, and dashboard shell — per `/ARCHITECTURE.md` and the approved Phase 0 implementation plan.

## Before running anything

1. `cp .env.example .env` and fill in a real `DATABASE_URL` pointing at a Postgres instance you control.
2. `npm install`
3. `npx prisma migrate dev --name phase_0_init`
4. `npx prisma db seed`
5. `npm test`
6. `npm run build`
7. `npm run dev`

None of the above has been executed against a real network/database connection as part of this build — the sandbox this was built in has no registry or database access (confirmed: `npm ping` returns `403 Forbidden`; no local Postgres binary present). Every file was written to compile and run correctly, and was checked as far as static analysis allows (Prisma schema structural checks, Node's native TypeScript syntax checking on every `.ts` file, brace/paren balance checks on every `.tsx` file) — but static analysis is not proof. Run the seven steps above for real before trusting this as "Phase 0 complete."

## What's real vs. placeholder right now

- Everything under `lib/`, `prisma/schema.prisma`, the API routes, and the permission/audit/documents logic is fully implemented, not stubbed.
- The dashboard's **Recent Activity** widget pulls real data from the audit log — the one dashboard widget with live data behind it in Phase 0.
- Every other dashboard widget (KPIs, Profit & Cash Flow, AI Signals, Inventory Health, Top Opportunities, Cash Calendar, Data Health, Priority Products) is an honest "Available in Phase X" placeholder, by design — there is no Phase 1+ data yet to show.
- `ProductIdentifier` is designed in `schema.prisma` (commented out) and intentionally not created as a live table — it ships in Phase 1 alongside `Product`, per the approved plan.
