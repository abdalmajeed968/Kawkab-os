// tests/permissions.test.ts
//
// Pure unit tests — no database, no network. These should be the first
// thing that passes once `npm install` succeeds anywhere with registry
// access, as a quick signal the core RBAC logic is sound before anything
// database-dependent is attempted.

import { describe, it, expect } from "vitest";
import { can, requirePermission, PermissionError } from "../lib/permissions";

describe("OWNER", () => {
  it("can perform every Phase 0 permission action", () => {
    const actions = [
      "manage_users",
      "view_audit_log",
      "upload_document",
      "manage_business_records",
      "configure_marketplace",
      "verify_information",
    ] as const;
    for (const action of actions) {
      expect(can("OWNER", action)).toBe(true);
    }
  });
});

describe("OPERATOR", () => {
  it("can upload documents, manage business records, and verify information", () => {
    expect(can("OPERATOR", "upload_document")).toBe(true);
    expect(can("OPERATOR", "manage_business_records")).toBe(true);
    expect(can("OPERATOR", "verify_information")).toBe(true);
  });

  it("cannot manage users, view the audit log, or configure marketplaces", () => {
    expect(can("OPERATOR", "manage_users")).toBe(false);
    expect(can("OPERATOR", "view_audit_log")).toBe(false);
    expect(can("OPERATOR", "configure_marketplace")).toBe(false);
  });

  it("requirePermission throws PermissionError, not a generic error, for a denied action", () => {
    expect(() => requirePermission("OPERATOR", "manage_users")).toThrow(PermissionError);
  });
});

describe("AI_AGENT", () => {
  it("cannot perform any mutating action in Phase 0", () => {
    const actions = [
      "manage_users",
      "view_audit_log",
      "upload_document",
      "manage_business_records",
      "configure_marketplace",
      "verify_information",
    ] as const;
    for (const action of actions) {
      expect(can("AI_AGENT", action)).toBe(false);
    }
  });
});
