import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPurchase, listPurchases } from "@/lib/purchases";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const purchases = await listPurchases();
  return NextResponse.json({ purchases });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.supplierId || !body.purchaseDate || body.invoiceTotal === undefined || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "supplierId, purchaseDate, invoiceTotal, and items[] are required" }, { status: 400 });
  }
  if (!body.invoiceNumber || !String(body.invoiceNumber).trim()) {
    return NextResponse.json(
      { error: "An invoice/order number is required to create a Purchase. The document itself can be attached later." },
      { status: 400 }
    );
  }

  try {
    const purchase = await createPurchase(
      {
        supplierId: body.supplierId,
        purchaseDate: new Date(body.purchaseDate),
        invoiceNumber: String(body.invoiceNumber).trim(),
        invoiceTotal: Number(body.invoiceTotal),
        tax: body.tax !== undefined && body.tax !== "" ? Number(body.tax) : null,
        discount: body.discount !== undefined && body.discount !== "" ? Number(body.discount) : null,
        supplierShipping: body.supplierShipping !== undefined && body.supplierShipping !== "" ? Number(body.supplierShipping) : null,
        localShipping: body.localShipping !== undefined && body.localShipping !== "" ? Number(body.localShipping) : null,
        prepCost: body.prepCost !== undefined && body.prepCost !== "" ? Number(body.prepCost) : null,
        packagingCost: body.packagingCost !== undefined && body.packagingCost !== "" ? Number(body.packagingCost) : null,
        otherCost: body.otherCost !== undefined && body.otherCost !== "" ? Number(body.otherCost) : null,
        notes: body.notes,
        items: body.items.map((i: { productId: string; quantity: number; unitCost?: number; lineItemCost?: number }) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitCost: i.unitCost !== undefined ? Number(i.unitCost) : undefined,
          lineItemCost: i.lineItemCost !== undefined ? Number(i.lineItemCost) : undefined,
        })),
      },
      user.id,
      user.role
    );
    return NextResponse.json({ purchase }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
