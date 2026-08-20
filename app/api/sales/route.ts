import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listSales, createManualSale } from "@/lib/sales";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sales = await listSales();
  return NextResponse.json({ sales });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.saleDate || !Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "saleDate and at least one item are required" }, { status: 400 });
  }

  try {
    const result = await createManualSale(
      {
        saleDate: new Date(body.saleDate),
        marketplaceId: body.marketplaceId || null,
        notes: body.notes,
        items: body.items.map((i: { productId: string; quantity: number; unitSellingPrice: number }) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitSellingPrice: Number(i.unitSellingPrice),
        })),
      },
      user.id,
      user.role
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
