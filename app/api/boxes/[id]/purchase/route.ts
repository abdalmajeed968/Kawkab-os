import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordBoxPurchase } from "@/lib/boxes";
import { PermissionError, Role } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.quantity) return NextResponse.json({ error: "quantity is required" }, { status: 400 });

  try {
    const movement = await recordBoxPurchase(
      {
        boxTypeId: params.id,
        quantity: Number(body.quantity),
        unitCost: body.unitCost !== undefined && body.unitCost !== "" ? Number(body.unitCost) : null,
        invoiceNumber: body.invoiceNumber,
        notes: body.notes,
      },
      user.id,
      user.role
    );
    return NextResponse.json({ movement }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
