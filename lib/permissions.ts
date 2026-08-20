// lib/permissions.ts
//
// Service-level permission enforcement. Every mutating service function
// calls requirePermission() before touching data — this is the actual
// enforcement point, not the UI, which only hides controls as a courtesy.
//
// Kept as a type-checked constant rather than a database table by
// deliberate choice: for a single-business, owner-operated system, a
// DB-editable permission table adds real risk (a UI bug could silently
// grant AI_AGENT more than it should ever have) for very little benefit
// at this scale. Revisit if KAWKAB ever needs runtime-configurable roles.

export type Role = "OWNER" | "OPERATOR" | "AI_AGENT";

export type PermissionAction =
  | "manage_users"
  | "view_audit_log"
  | "upload_document"
  | "manage_business_records"
  | "configure_marketplace"
  | "verify_information"
  // Phase 1A additions
  | "manage_products"
  | "manage_product_identifiers"
  | "manage_purchases"
  | "correct_purchase"
  | "manage_suppliers"
  | "manage_eligibility"
  | "verify_document"
  // Phase 1B additions
  | "record_consumption"
  | "correct_consumption"
  // Phase 2 additions
  | "manage_boxes"
  | "correct_box_movement"
  | "manage_shipments"
  | "correct_shipment"
  | "manage_brands"
  // Phase 2 additions (Research)
  | "manage_research"
  // Real Data: Sales / Import
  | "manage_imports"
  | "correct_sale";

const PERMISSIONS: Record<Role, PermissionAction[]> = {
  OWNER: [
    "manage_users",
    "view_audit_log",
    "upload_document",
    "manage_business_records",
    "configure_marketplace",
    "verify_information",
    "manage_products",
    "manage_product_identifiers",
    "manage_purchases",
    "correct_purchase",
    "manage_suppliers",
    "manage_eligibility",
    "verify_document",
    "record_consumption",
    "correct_consumption",
    "manage_boxes",
    "correct_box_movement",
    "manage_shipments",
    "correct_shipment",
    "manage_brands",
    "manage_research",
    "manage_imports",
    "correct_sale",
  ],
  OPERATOR: [
    "upload_document",
    "manage_business_records",
    "verify_information",
    "manage_products",
    "manage_purchases",
    "manage_suppliers",
    "verify_document",
    "record_consumption",
    "manage_boxes",
    "manage_shipments",
    "manage_brands",
    "manage_research",
    "manage_imports",
    // Deliberately absent: correct_sale — reversing a committed sale's
    // inventory consumption is a judgment call, same reasoning as
    // correct_purchase/correct_consumption being Owner-only.
    // Deliberately absent: manage_users, view_audit_log,
    // configure_marketplace — Owner only.
    // Deliberately absent: manage_product_identifiers, correct_purchase,
    // manage_eligibility, correct_consumption, correct_box_movement,
    // correct_shipment — these touch identity history, cost history,
    // quantity history, or Amazon-approval strategy, all judgment calls
    // reserved for the Owner. Revisit if Operator's role expands later.
  ],
  AI_AGENT: [
    // Deliberately empty in Phase 0/1A. AI reads and drafts in later
    // phases (Phase 6+) but mutates nothing here — matches the
    // architecture review's stance that AI never spends money or acts
    // unsupervised.
  ],
};

export class PermissionError extends Error {
  constructor(
    public readonly role: Role,
    public readonly permAction: PermissionAction
  ) {
    super(`Role ${role} is not permitted to perform "${permAction}".`);
    this.name = "PermissionError";
  }
}

export function requirePermission(role: Role, action: PermissionAction): void {
  if (!PERMISSIONS[role]?.includes(action)) {
    throw new PermissionError(role, action);
  }
}

export function can(role: Role, action: PermissionAction): boolean {
  return PERMISSIONS[role]?.includes(action) ?? false;
}
