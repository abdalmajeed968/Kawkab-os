import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { linkProductToBrand } from "@/lib/brands";
import { PermissionError, Role } from "@/lib/permissions";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  try {
    const product = await linkProductToBrand(params.id, body.brandId || null, user.id, user.role);
    return NextResponse.json({ product });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
