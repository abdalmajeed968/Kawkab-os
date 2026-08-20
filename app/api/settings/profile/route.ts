import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateUserProfile } from "@/lib/settings";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string };

  const body = await req.json();
  try {
    const updated = await updateUserProfile(user.id, { name: body.name, newPassword: body.newPassword }, user.id);
    return NextResponse.json({ user: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
