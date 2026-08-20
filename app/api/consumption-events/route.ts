import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordConsumptionEvent, InsufficientInventoryError } from "@/lib/fifo";
import { PermissionError, Role } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.productId || !body.type || !body.quantity || !body.eventDate) {
    return NextResponse.json({ error: "productId, type, quantity, and eventDate are required" }, { status: 400 });
  }
  if (body.type !== "MANUAL_SALE" && body.type !== "MANUAL_ADJUSTMENT") {
    return NextResponse.json({ error: "type must be MANUAL_SALE or MANUAL_ADJUSTMENT" }, { status: 400 });
  }

  try {
    const result = await recordConsumptionEvent(
      {
        productId: body.productId,
        type: body.type,
        quantity: Number(body.quantity),
        eventDate: new Date(body.eventDate),
        notes: body.notes,
      },
      user.id,
      user.role
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof InsufficientInventoryError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
