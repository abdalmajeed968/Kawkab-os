import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { commitSaleItem } from "@/lib/sales";
import { PermissionError, Role } from "@/lib/permissions";
import { InsufficientInventoryError } from "@/lib/fifo";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  try {
    const result = await commitSaleItem(params.id, user.id, user.role);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof InsufficientInventoryError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
