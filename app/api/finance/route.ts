import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFinanceSummary, getProductCostBreakdown } from "@/lib/finance";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [summary, productCosts] = await Promise.all([getFinanceSummary(), getProductCostBreakdown()]);
  return NextResponse.json({ summary, productCosts });
}
