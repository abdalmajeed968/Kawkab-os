import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { commitSalesBatch, commitFinanceBatch } from "@/lib/salesImport";
import { PermissionError, Role } from "@/lib/permissions";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  try {
    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: params.id } });

    if (batch.reportType === "SALES") {
      const result = await commitSalesBatch(params.id, user.id, user.role);
      return NextResponse.json(result);
    }
    if (batch.reportType === "FINANCE") {
      const result = await commitFinanceBatch(params.id, user.id, user.role);
      return NextResponse.json(result);
    }
    return NextResponse.json(
      { error: "INVENTORY report commit is not implemented — inventory reports are preserved as raw rows only in this phase." },
      { status: 400 }
    );
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
