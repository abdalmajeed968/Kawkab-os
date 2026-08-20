import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { upsertProductEligibility } from "@/lib/eligibility";
import { PermissionError, Role } from "@/lib/permissions";

export async function PUT(req: NextRequest, { params }: { params: { productId: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();

  try {
    const eligibility = await upsertProductEligibility(
      params.productId,
      {
        status: body.status,
        approvalStatus: body.approvalStatus,
        approvalNotes: body.approvalNotes,
        potentialSupplierId: body.potentialSupplierId,
        invoicePathNotes: body.invoicePathNotes,
        targetBuyPrice: body.targetBuyPrice !== undefined && body.targetBuyPrice !== "" ? Number(body.targetBuyPrice) : null,
        ownerNotes: body.ownerNotes,
      },
      user.id,
      user.role
    );
    return NextResponse.json({ eligibility });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
