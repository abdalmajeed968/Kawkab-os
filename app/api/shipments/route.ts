import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createShipment, listShipments, InsufficientInventoryError, InsufficientBoxStockError } from "@/lib/shipments";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const shipments = await listShipments();
  return NextResponse.json({ shipments });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.reference || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "reference and at least one item are required" }, { status: 400 });
  }

  try {
    const shipment = await createShipment(
      {
        reference: body.reference,
        destinationType: body.destinationType,
        destinationName: body.destinationName,
        marketplaceId: body.marketplaceId || null,
        carrier: body.carrier,
        trackingNumber: body.trackingNumber,
        shipDate: body.shipDate ? new Date(body.shipDate) : null,
        shippingCost: body.shippingCost !== undefined && body.shippingCost !== "" ? Number(body.shippingCost) : null,
        prepCost: body.prepCost !== undefined && body.prepCost !== "" ? Number(body.prepCost) : null,
        notes: body.notes,
        items: body.items.map((i: { productId: string; quantity: number }) => ({ productId: i.productId, quantity: Number(i.quantity) })),
        boxes: (body.boxes ?? []).map((b: { boxTypeId: string; quantity: number }) => ({ boxTypeId: b.boxTypeId, quantity: Number(b.quantity) })),
      },
      user.id,
      user.role
    );
    return NextResponse.json({ shipment }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof InsufficientInventoryError || e instanceof InsufficientBoxStockError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
