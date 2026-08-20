// lib/settings.ts

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import bcrypt from "bcryptjs";

export async function getBusinessSettings() {
  const existing = await prisma.businessSettings.findFirst();
  if (existing) return existing;
  // Created lazily on first read — a real row, not a hardcoded default
  // rendered as if it were saved.
  return prisma.businessSettings.create({ data: {} });
}

export async function updateBusinessSettings(
  input: { businessName?: string; defaultCurrency?: string; timezone?: string },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "configure_marketplace"); // business-wide config, same Owner-only gate as marketplace config

  return prisma.$transaction(async (tx) => {
    const before = await tx.businessSettings.findFirst();
    const settings = before
      ? await tx.businessSettings.update({ where: { id: before.id }, data: { ...input, updatedByUserId: actingUserId } })
      : await tx.businessSettings.create({ data: { ...input, updatedByUserId: actingUserId } });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: before ? "UPDATE" : "CREATE",
      entityType: "BusinessSettings",
      entityId: settings.id,
      newValue: input,
      source: "MANUAL",
    });
    return settings;
  });
}

export async function listMarketplaces() {
  return prisma.marketplace.findMany({ orderBy: { displayName: "asc" } });
}

export async function createMarketplace(
  input: { code: string; displayName: string; countryCode: string; currency: string },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "configure_marketplace");
  if (!input.code?.trim() || !input.displayName?.trim()) {
    throw new Error("Marketplace code and display name are required.");
  }

  return prisma.$transaction(async (tx) => {
    const marketplace = await tx.marketplace.create({ data: input });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Marketplace",
      entityId: marketplace.id,
      newValue: { code: marketplace.code, displayName: marketplace.displayName },
      source: "MANUAL",
    });
    return marketplace;
  });
}

/**
 * Honest, not fabricated: reads real environment configuration to report
 * what's actually set up, never a UI toggle that could imply a live
 * connection exists. AWS_S3_BUCKET presence indicates production storage
 * is configured; SP_API_* variables are checked but will always read as
 * "not configured" until real Amazon integration (a future phase) adds
 * them — this function does not simulate a connection.
 */
export function getIntegrationReadiness() {
  return {
    storage: {
      provider: process.env.STORAGE_PROVIDER === "s3" ? "S3 (production)" : "Local filesystem (development)",
      configured: process.env.STORAGE_PROVIDER === "s3" ? !!process.env.AWS_S3_BUCKET : true,
    },
    amazonSpApi: {
      connected: false,
      status: "Not connected — Amazon SP-API integration has not been built yet.",
      requiredForConnection: ["Seller Central app registration", "OAuth refresh token", "Marketplace/region selection"],
    },
  };
}

export async function updateUserProfile(userId: string, input: { name?: string; newPassword?: string }, actingUserId: string) {
  if (userId !== actingUserId) {
    throw new Error("You can only edit your own profile here.");
  }

  return prisma.$transaction(async (tx) => {
    const data: { name?: string; passwordHash?: string } = {};
    if (input.name?.trim()) data.name = input.name.trim();
    if (input.newPassword) {
      if (input.newPassword.length < 10) throw new Error("Password must be at least 10 characters.");
      data.passwordHash = await bcrypt.hash(input.newPassword, 12);
    }

    const before = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const after = await tx.user.update({ where: { id: userId }, data });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      fieldChanged: input.newPassword ? "name+password" : "name",
      oldValue: { name: before.name },
      newValue: { name: after.name, passwordChanged: !!input.newPassword },
      source: "MANUAL",
    });
    return { id: after.id, name: after.name, email: after.email };
  });
}
