import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createBoxType, listBoxTypes } from "@/lib/boxes";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await listBoxTypes();
  return NextResponse.json({ boxTypes: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const boxType = await createBoxType(
      {
        name: body.name,
        lengthCm: body.lengthCm !== undefined && body.lengthCm !== "" ? Number(body.lengthCm) : null,
        widthCm: body.widthCm !== undefined && body.widthCm !== "" ? Number(body.widthCm) : null,
        heightCm: body.heightCm !== undefined && body.heightCm !== "" ? Number(body.heightCm) : null,
        weightCapacityKg: body.weightCapacityKg !== undefined && body.weightCapacityKg !== "" ? Number(body.weightCapacityKg) : null,
        supplierId: body.supplierId || null,
        lowStockThreshold: body.lowStockThreshold !== undefined && body.lowStockThreshold !== "" ? Number(body.lowStockThreshold) : null,
        notes: body.notes,
      },
      user.id,
      user.role
    );
    return NextResponse.json({ boxType }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
