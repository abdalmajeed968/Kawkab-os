import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadDocumentForResearch } from "@/lib/documents";
import { PermissionError, Role } from "@/lib/permissions";
import { DocumentType } from "@prisma/client";

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id: string; role: Role };

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const documentType = (formData.get("documentType") as DocumentType | null) ?? "OTHER";
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: "File exceeds the 20MB upload limit" }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await uploadDocumentForResearch(
      {
        buffer,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        type: documentType,
        researchEntryId: params.id,
      },
      user.id,
      user.role
    );
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof PermissionError) return NextResponse.json({ error: e.message }, { status: 403 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
