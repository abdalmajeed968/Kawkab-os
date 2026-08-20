import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPurchase, correctPurchase } from "@/lib/purchases";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await getPurchase(params.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.reason) return NextResponse.json({ error: "A correction reason is required" }, { status: 400 });

  try {
    const purchase = await correctPurchase(
      params.id,
      {
        supplierShipping: body.supplierShipping,
        localShipping: body.localShipping,
        prepCost: body.prepCost,
        packagingCost: body.packagingCost,
        otherCost: body.otherCost,
        tax: body.tax,
        discount: body.discount,
        invoiceTotal: body.invoiceTotal,
        reason: body.reason,
      },
      user.id,
      user.role
    );
    return NextResponse.json({ purchase });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
