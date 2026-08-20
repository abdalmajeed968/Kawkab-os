import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { startImport, listImportBatches } from "@/lib/salesImport";
import { PermissionError, Role } from "@/lib/permissions";
import { ImportReportType } from "@prisma/client";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;
const VALID_TYPES: ImportReportType[] = ["SALES", "FINANCE", "INVENTORY"];

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const batches = await listImportBatches();
  return NextResponse.json({ batches });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const reportType = formData.get("reportType") as ImportReportType | null;

  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!reportType || !VALID_TYPES.includes(reportType)) {
    return NextResponse.json({ error: "reportType must be one of SALES, FINANCE, INVENTORY" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 25MB upload limit" }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const batch = await startImport({ filename: file.name, buffer, reportType }, user.id, user.role);
    return NextResponse.json({ batch }, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
