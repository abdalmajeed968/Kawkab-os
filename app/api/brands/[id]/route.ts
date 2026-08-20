import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBrand, updateBrand } from "@/lib/brands";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const brand = await getBrand(params.id);
    return NextResponse.json({ brand });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  try {
    const brand = await updateBrand(
      params.id,
      { name: body.name, website: body.website, supplierId: body.supplierId, relationshipStatus: body.relationshipStatus, notes: body.notes },
      user.id,
      user.role
    );
    return NextResponse.json({ brand });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
