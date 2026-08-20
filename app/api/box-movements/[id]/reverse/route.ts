import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reverseBoxMovement } from "@/lib/boxes";
import { PermissionError, Role } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 });

  try {
    const reversal = await reverseBoxMovement(params.id, body.reason, user.id, user.role);
    return NextResponse.json({ reversal });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
