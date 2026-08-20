import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordBoxConsumption, InsufficientBoxStockError } from "@/lib/boxes";
import { PermissionError, Role } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.quantity) return NextResponse.json({ error: "quantity is required" }, { status: 400 });

  try {
    const movement = await recordBoxConsumption(
      { boxTypeId: params.id, quantity: Number(body.quantity), type: "MANUAL_ADJUSTMENT", notes: body.notes },
      user.id,
      user.role
    );
    return NextResponse.json({ movement }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof InsufficientBoxStockError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
