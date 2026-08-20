import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { verifyDocument } from "@/lib/documents";
import { PermissionError, Role } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.documentId) return NextResponse.json({ error: "documentId is required" }, { status: 400 });

  try {
    const document = await verifyDocument(body.documentId, body.confirmedValues, user.id, user.role);
    return NextResponse.json({ document });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
