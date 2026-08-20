import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listInventorySummary } from "@/lib/inventory";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await listInventorySummary();
  return NextResponse.json({ rows });
}
