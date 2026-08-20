import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logBrandActivity } from "@/lib/brands";
import { PermissionError, Role } from "@/lib/permissions";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const body = await req.json();
  if (!body.type || !body.summary || !body.activityDate) {
    return NextResponse.json({ error: "type, summary, and activityDate are required" }, { status: 400 });
  }

  try {
    const activity = await logBrandActivity(
      {
        brandId: params.id,
        type: body.type,
        summary: body.summary,
        activityDate: new Date(body.activityDate),
        followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
      },
      user.id,
      user.role
    );
    return NextResponse.json({ activity }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
