import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateShipmentStatus } from "@/lib/shipments";
import { PermissionError, Role } from "@/lib/permissions";
import { ShipmentStatus } from "@prisma/client";

const VALID: ShipmentStatus[] = ["DRAFT", "PACKED", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.status || !VALID.includes(body.status)) {
    return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
  }

  try {
    const shipment = await updateShipmentStatus(params.id, body.status, user.id, user.role);
    return NextResponse.json({ shipment });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
