import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveUnmatchedRow } from "@/lib/salesImport";
import { PermissionError, Role } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });

  try {
    const row = await resolveUnmatchedRow(params.id, body.productId, user.id, user.role);
    return NextResponse.json({ row });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
