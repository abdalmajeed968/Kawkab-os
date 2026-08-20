import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupplier, updateSupplier } from "@/lib/suppliers";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supplier = await getSupplier(params.id);
    return NextResponse.json({ supplier });
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
    const supplier = await updateSupplier(
      params.id,
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
    return NextResponse.json({ supplier });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
