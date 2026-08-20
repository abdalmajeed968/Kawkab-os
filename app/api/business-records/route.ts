import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, PermissionError, Role } from "@/lib/permissions";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role: Role }).role;

  const records = await prisma.businessRecord.findMany({
    where: role === "OPERATOR" ? { visibleToOperator: true } : {},
    orderBy: { createdAt: "desc" },
    include: { documents: { include: { document: true } } },
  });

  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.name || !body.category) {
    return NextResponse.json({ error: "name and category are required" }, { status: 400 });
  }

  try {
    requirePermission(user.role, "manage_business_records");
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.businessRecord.create({
      data: {
        name: body.name,
        category: body.category,
        issueDate: body.issueDate ? new Date(body.issueDate) : undefined,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : undefined,
        documentNumber: body.documentNumber,
        visibleToOperator: !!body.visibleToOperator,
        notes: body.notes,
      },
    });
    await writeAuditLog(tx, {
      userId: user.id,
      action: "CREATE",
      entityType: "BusinessRecord",
      entityId: created.id,
      newValue: { name: created.name, category: created.category },
      source: "MANUAL",
    });
    return created;
  });

  return NextResponse.json({ record }, { status: 201 });
}
