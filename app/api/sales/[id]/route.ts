import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSale } from "@/lib/sales";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sale = await getSale(params.id);
    return NextResponse.json({ sale });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 });
  }
}
