import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBusinessSettings, updateBusinessSettings } from "@/lib/settings";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getBusinessSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  try {
    const settings = await updateBusinessSettings(
      { businessName: body.businessName, defaultCurrency: body.defaultCurrency, timezone: body.timezone },
      user.id,
      user.role
    );
    return NextResponse.json({ settings });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
