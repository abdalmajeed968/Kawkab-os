import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listBusinessRecordDocuments } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role: Role }).role;

  try {
    const record = await prisma.businessRecord.findUniqueOrThrow({ where: { id: params.id } });
    const documents = await listBusinessRecordDocuments(params.id, role);
    return NextResponse.json({ record, documents });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
