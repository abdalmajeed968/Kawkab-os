import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { matchImportBatch } from "@/lib/salesImport";
import { PermissionError, Role } from "@/lib/permissions";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  try {
    const result = await matchImportBatch(params.id, user.id, user.role);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
