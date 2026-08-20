import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDocumentFileForRole } from "@/lib/documents";
import { Role } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role: Role }).role;

  try {
    // Re-checks the same visibility rule the upload/metadata paths use —
    // this route is the one flagged explicitly in the implementation plan
    // as needing its own enforcement, not a free pass because the upload
    // was already gated.
    const { buffer, mimeType, filename } = await getDocumentFileForRole(decodeURIComponent(params.key), role);
    // Phase 0 runtime fix: NextResponse's body type doesn't accept a Node
    // Buffer directly under strict typing — wrap in Uint8Array.
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
