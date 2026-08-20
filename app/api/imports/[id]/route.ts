import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getImportBatch } from "@/lib/salesImport";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const batch = await getImportBatch(params.id);
    return NextResponse.json({ batch });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
