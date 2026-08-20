// lib/suppliers.ts

import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";

export interface SupplierInput {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
}

/**
 * Optional and permissive on purpose — the requirement is "a valid URL
 * shape where a value is given," not "force a strict scheme." Accepts a
 * bare domain (kawkab-supplier.com) as well as a full URL, and normalizes
 * a bare domain to https:// so it's always usable as a link later. Empty
 * string is treated the same as not provided — never required.
 */
export function normalizeAndValidateWebsite(raw: string | undefined | null): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const value = raw.trim();
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) {
      throw new Error("invalid");
    }
    return url.toString();
  } catch {
    throw new Error(`"${raw}" doesn't look like a valid website.`);
  }
}

export async function createSupplier(input: SupplierInput, actingUserId: string, role: Role) {
  requirePermission(role, "manage_suppliers");

  const website = normalizeAndValidateWebsite(input.website);

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({
      data: { name: input.name, email: input.email, phone: input.phone, website, notes: input.notes },
    });
    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "Supplier",
      entityId: supplier.id,
      newValue: { name: supplier.name, website: supplier.website },
      source: "MANUAL",
    });
    return supplier;
  });
}

export async function updateSupplier(
  supplierId: string,
  input: Partial<SupplierInput>,
  actingUserId: string,
  role: Role
) {
  requirePermission(role, "manage_suppliers");

  const website = input.website !== undefined ? normalizeAndValidateWebsite(input.website) : undefined;

  return prisma.$transaction(async (tx) => {
    const before = await tx.supplier.findUniqueOrThrow({ where: { id: supplierId } });

    const after = await tx.supplier.update({
      where: { id: supplierId },
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        website: input.website !== undefined ? (website ?? null) : undefined,
        notes: input.notes,
      },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "UPDATE",
      entityType: "Supplier",
      entityId: supplierId,
      oldValue: { name: before.name, email: before.email, phone: before.phone, website: before.website, notes: before.notes },
      newValue: { name: after.name, email: after.email, phone: after.phone, website: after.website, notes: after.notes },
      source: "MANUAL",
    });

    return after;
  });
}

export async function listSuppliers() {
  return prisma.supplier.findMany({ orderBy: { name: "asc" } });
}

export async function getSupplier(supplierId: string) {
  return prisma.supplier.findUniqueOrThrow({
    where: { id: supplierId },
    include: {
      purchases: {
        include: { items: { include: { product: true } }, documents: true },
        orderBy: { purchaseDate: "desc" },
      },
    },
  });
}
