import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSupplier, listSuppliers } from "@/lib/suppliers";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const suppliers = await listSuppliers();
  return NextResponse.json({ suppliers });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const supplier = await createSupplier(
      {
        name: body.name,
        contactName: body.contactName,
        email: body.email,
        phone: body.phone,
        website: body.website,
        accountNumber: body.accountNumber,
        paymentTerms: body.paymentTerms,
        notes: body.notes,
      },
      user.id,
      user.role
    );
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
