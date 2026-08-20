import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createUser, listUsers } from "@/lib/users";
import { PermissionError, Role } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role } = session.user as { role: Role };

  try {
    const users = await listUsers(role);
    return NextResponse.json({ users });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actingUser = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.name || !body.email || !body.password || !body.role) {
    return NextResponse.json({ error: "name, email, password, and role are required" }, { status: 400 });
  }
  if (!["OWNER", "OPERATOR", "AI_AGENT"].includes(body.role)) {
    return NextResponse.json({ error: `Unknown role "${body.role}"` }, { status: 400 });
  }
  if (body.password.length < 10) {
    return NextResponse.json({ error: "Password must be at least 10 characters." }, { status: 400 });
  }

  try {
    const user = await createUser(
      { name: body.name, email: body.email, password: body.password, role: body.role as UserRole },
      actingUser.id,
      actingUser.role
    );
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
    }
    throw e;
  }
}
