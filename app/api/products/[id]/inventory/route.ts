import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAvailableBatches, getInventoryOnHand, listConsumptionEvents } from "@/lib/inventory";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [batches, onHand, events] = await Promise.all([
    getAvailableBatches(params.id),
    getInventoryOnHand(params.id),
    listConsumptionEvents(params.id),
  ]);

  return NextResponse.json({ batches, quantityOnHand: onHand, events });
}
