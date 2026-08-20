import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActionCenterItems } from "@/lib/actionCenter";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await getActionCenterItems();
  return NextResponse.json({ items });
}
