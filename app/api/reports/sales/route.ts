import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProductPerformanceReport, getSalesTimeSeriesReport, getMarketplaceSalesReport } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const granularity = (params.get("granularity") as "day" | "week" | "month") || "day";
  const to = params.get("to") ? new Date(params.get("to")!) : new Date();
  const from = params.get("from")
    ? new Date(params.get("from")!)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [productPerformance, timeSeries, marketplaceSales] = await Promise.all([
    getProductPerformanceReport(from, to),
    getSalesTimeSeriesReport(from, to, granularity),
    getMarketplaceSalesReport(),
  ]);

  return NextResponse.json({ productPerformance, timeSeries, marketplaceSales, range: { from, to, granularity } });
}
