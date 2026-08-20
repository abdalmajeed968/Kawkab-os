import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createResearchEntry, listResearchEntries } from "@/lib/research";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const entries = await listResearchEntries();
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.title) return NextResponse.json({ error: "title is required" }, { status: 400 });

  try {
    const entry = await createResearchEntry(
      {
        title: body.title,
        asin: body.asin,
        sku: body.sku,
        supplierId: body.supplierId || null,
        assumedCost: body.assumedCost !== undefined && body.assumedCost !== "" ? Number(body.assumedCost) : null,
        assumedSellingPrice: body.assumedSellingPrice !== undefined && body.assumedSellingPrice !== "" ? Number(body.assumedSellingPrice) : null,
        competitionNotes: body.competitionNotes,
        restrictionNotes: body.restrictionNotes,
        status: body.status,
        sourceUrl: body.sourceUrl,
        notes: body.notes,
      },
      user.id,
      user.role
    );
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
