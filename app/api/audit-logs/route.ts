import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionError, Role } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as { role: Role };

  try {
    requirePermission(role, "view_audit_log");
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const take = Math.min(Number(req.nextUrl.searchParams.get("take") ?? 50), 200);
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take,
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ logs });
}
