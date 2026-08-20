import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createProduct, listProducts, ProductTab } from "@/lib/products";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tab = (req.nextUrl.searchParams.get("tab") as ProductTab) || "all";
  const products = await listProducts(tab);
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const product = await createProduct(
      { name: body.name, brand: body.brand, fulfillmentType: body.fulfillmentType, notes: body.notes },
      user.id,
      user.role
    );
    return NextResponse.json({ product }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
