import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addBrandContact } from "@/lib/brands";
import { PermissionError, Role } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  try {
    const contact = await addBrandContact(
      { brandId: params.id, name: body.name, email: body.email, phone: body.phone, title: body.title, notes: body.notes },
      user.id,
      user.role
    );
    return NextResponse.json({ contact }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
