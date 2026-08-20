import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBrand, listBrands } from "@/lib/brands";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brands = await listBrands();
  return NextResponse.json({ brands });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const brand = await createBrand(
      { name: body.name, website: body.website, supplierId: body.supplierId || null, relationshipStatus: body.relationshipStatus, notes: body.notes },
      user.id,
      user.role
    );
    return NextResponse.json({ brand }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
