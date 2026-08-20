// lib/users.ts
//
// Owner-only user management. Password reset / self-service invitation is
// explicitly out of scope for Phase 0 per Owner approval — the Owner
// account is created by prisma/seed.ts, and any additional Operator/
// AI_AGENT accounts are created here by the Owner directly.

import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { requirePermission, Role } from "./permissions";
import { writeAuditLog } from "./audit";
import { UserRole } from "@prisma/client";

const BCRYPT_ROUNDS = 12;

export async function createUser(
  input: { name: string; email: string; password: string; role: UserRole },
  actingUserId: string,
  actingRole: Role
) {
  requirePermission(actingRole, "manage_users");

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name, email: input.email, passwordHash, role: input.role },
    });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      newValue: { name: user.name, email: user.email, role: user.role },
      source: "MANUAL",
    });

    return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
  });
}

export async function suspendUser(userId: string, actingUserId: string, actingRole: Role, reason: string) {
  requirePermission(actingRole, "manage_users");

  return prisma.$transaction(async (tx) => {
    const before = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const after = await tx.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });

    await writeAuditLog(tx, {
      userId: actingUserId,
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      fieldChanged: "status",
      oldValue: { status: before.status },
      newValue: { status: after.status, reason },
      source: "MANUAL",
    });

    return after;
  });
}

export async function listUsers(actingRole: Role) {
  requirePermission(actingRole, "manage_users");
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}
