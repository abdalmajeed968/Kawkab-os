import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProduct, updateProductStatus } from "@/lib/products";
import { computeProductDataHealth } from "@/lib/dataHealth";
import { computeDecisionBox } from "@/lib/decisionBox";
import { PermissionError, Role } from "@/lib/permissions";
import { ProductStatus } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const product = await getProduct(params.id);
    const dataHealth = computeProductDataHealth(product);
    const decisionBox = computeDecisionBox(product);
    return NextResponse.json({ product, dataHealth, decisionBox });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.status || !["ACTIVE", "PAUSED", "ARCHIVED"].includes(body.status)) {
    return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
  }

  try {
    const product = await updateProductStatus(params.id, body.status as ProductStatus, user.id, user.role);
    return NextResponse.json({ product });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
