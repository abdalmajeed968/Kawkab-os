import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getResearchEntry, updateResearchEntry } from "@/lib/research";
import { PermissionError, Role } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const entry = await getResearchEntry(params.id);
    return NextResponse.json({ entry });
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
    const entry = await updateResearchEntry(
      params.id,
      {
        title: body.title,
        asin: body.asin,
        sku: body.sku,
        supplierId: body.supplierId,
        assumedCost: body.assumedCost !== undefined && body.assumedCost !== "" ? Number(body.assumedCost) : body.assumedCost === "" ? null : undefined,
        assumedSellingPrice:
          body.assumedSellingPrice !== undefined && body.assumedSellingPrice !== "" ? Number(body.assumedSellingPrice) : body.assumedSellingPrice === "" ? null : undefined,
        competitionNotes: body.competitionNotes,
        restrictionNotes: body.restrictionNotes,
        status: body.status,
        sourceUrl: body.sourceUrl,
        notes: body.notes,
      },
      user.id,
      user.role
    );
    return NextResponse.json({ entry });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
