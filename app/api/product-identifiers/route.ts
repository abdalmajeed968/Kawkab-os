import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setProductIdentifier, getProductIdentifierHistory } from "@/lib/productIdentifiers";
import { PermissionError, Role } from "@/lib/permissions";
import { IdentifierType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const productId = req.nextUrl.searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });

  const history = await getProductIdentifierHistory(productId);
  return NextResponse.json({ history });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.productId || !body.type || !body.value) {
    return NextResponse.json({ error: "productId, type, and value are required" }, { status: 400 });
  }

  try {
    const identifier = await setProductIdentifier(
      { productId: body.productId, marketplaceId: body.marketplaceId ?? null, type: body.type as IdentifierType, value: body.value },
      user.id,
      user.role
    );
    return NextResponse.json({ identifier }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
