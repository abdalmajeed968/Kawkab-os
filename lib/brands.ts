// lib/brands.ts

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { BrandRelationshipStatus, BrandActivityType } from "@prisma/client";

export interface BrandInput {
  name: string;
  website?: string;
  supplierId?: string | null;
  relationshipStatus?: BrandRelationshipStatus;
  notes?: string;
}

export async function createBrand(input: BrandInput, actingUserId: string, role: Role) {
  requirePermission(role, "manage_brands");
  if (!input.name?.trim()) throw new Error("Brand name is required.");

  return prisma.$transaction(async (tx) => {
    const brand = await tx.brand.create({
      data: {
        name: input.name.trim(),
        website: input.website,
        supplierId: input.supplierId ?? undefined,
        relationshipStatus: input.relationshipStatus ?? "NOT_CONTACTED",
        notes: input.notes,
        createdByUserId: actingUserId,
      },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Brand",
      entityId: brand.id,
      newValue: { name: brand.name },
      source: "MANUAL",
    });
    return brand;
  });
}

export async function updateBrand(brandId: string, input: Partial<BrandInput>, actingUserId: string, role: Role) {
  requirePermission(role, "manage_brands");

  return prisma.$transaction(async (tx) => {
    const before = await tx.brand.findUniqueOrThrow({ where: { id: brandId } });
    const after = await tx.brand.update({
      where: { id: brandId },
      data: {
        name: input.name,
        website: input.website,
        supplierId: input.supplierId,
        relationshipStatus: input.relationshipStatus,
        notes: input.notes,
      },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "UPDATE",
      entityType: "Brand",
      entityId: brandId,
      oldValue: { relationshipStatus: before.relationshipStatus },
      newValue: { relationshipStatus: after.relationshipStatus },
      source: "MANUAL",
    });
    return after;
  });
}

export async function addBrandContact(
  input: { brandId: string; name: string; email?: string; phone?: string; title?: string; notes?: string },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "manage_brands");
  if (!input.name?.trim()) throw new Error("Contact name is required.");

  return prisma.$transaction(async (tx) => {
    const contact = await tx.brandContact.create({ data: input });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "BrandContact",
      entityId: contact.id,
      newValue: { brandId: input.brandId, name: contact.name },
      source: "MANUAL",
    });
    return contact;
  });
}

export async function logBrandActivity(
  input: {
    brandId: string;
    type: BrandActivityType;
    summary: string;
    activityDate: Date;
    followUpDate?: Date | null;
  },
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "manage_brands");
  if (!input.summary?.trim()) throw new Error("An activity summary is required.");

  return prisma.$transaction(async (tx) => {
    const activity = await tx.brandActivity.create({
      data: { ...input, followUpDate: input.followUpDate ?? undefined, createdByUserId: actingUserId },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "BrandActivity",
      entityId: activity.id,
      newValue: { brandId: input.brandId, type: input.type, summary: input.summary },
      source: "MANUAL",
    });
    return activity;
  });
}

export async function linkProductToBrand(productId: string, brandId: string | null, actingUserId: string, role: Role) {
  requirePermission(role, "manage_products");
  return prisma.$transaction(async (tx) => {
    const before = await tx.product.findUniqueOrThrow({ where: { id: productId } });
    const after = await tx.product.update({ where: { id: productId }, data: { brandId } });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "UPDATE",
      entityType: "Product",
      entityId: productId,
      fieldChanged: "brandId",
      oldValue: { brandId: before.brandId },
      newValue: { brandId: after.brandId },
      source: "MANUAL",
    });
    return after;
  });
}

export async function listBrands() {
  return prisma.brand.findMany({
    include: { supplier: true, products: true, contacts: true, activities: true },
    orderBy: { name: "asc" },
  });
}

export async function getBrand(brandId: string) {
  return prisma.brand.findUniqueOrThrow({
    where: { id: brandId },
    include: {
      supplier: true,
      products: { include: { eligibility: true } },
      contacts: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { activityDate: "desc" } },
      documents: { include: { document: true } },
    },
  });
}

/** Upcoming/overdue follow-ups across every brand — backs the Action Center integration. */
export async function listUpcomingBrandFollowUps() {
  const now = new Date();
  return prisma.brandActivity.findMany({
    where: { followUpDate: { not: null, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } },
    include: { brand: true },
    orderBy: { followUpDate: "asc" },
  });
}
