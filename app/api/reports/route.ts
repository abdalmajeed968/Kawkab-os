import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getInventoryReport,
  getInventoryValuationReport,
  getPurchasesReport,
  getSupplierSpendReport,
  getMissingDataReport,
  getProductStatusReport,
  getShipmentStatusReport,
  getDataCompletenessReport,
} from "@/lib/reports";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [inventory, valuation, purchases, supplierSpend, missingData, productStatus, shipmentStatus, completeness] = await Promise.all([
    getInventoryReport(),
    getInventoryValuationReport(),
    getPurchasesReport(),
    getSupplierSpendReport(),
    getMissingDataReport(),
    getProductStatusReport(),
    getShipmentStatusReport(),
    getDataCompletenessReport(),
  ]);

  return NextResponse.json({ inventory, valuation, purchases, supplierSpend, missingData, productStatus, shipmentStatus, completeness });
}
