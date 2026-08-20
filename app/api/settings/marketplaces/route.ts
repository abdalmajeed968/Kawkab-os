import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listMarketplaces, createMarketplace } from "@/lib/settings";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const marketplaces = await listMarketplaces();
  return NextResponse.json({ marketplaces });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.code || !body.displayName || !body.countryCode || !body.currency) {
    return NextResponse.json({ error: "code, displayName, countryCode, and currency are required" }, { status: 400 });
  }

  try {
    const marketplace = await createMarketplace(
      { code: body.code, displayName: body.displayName, countryCode: body.countryCode, currency: body.currency },
      user.id,
      user.role
    );
    return NextResponse.json({ marketplace }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
