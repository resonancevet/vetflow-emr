import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { uploadFile } from "@/lib/s3";
import { db } from "@openpims/db/client";
import { files } from "@openpims/db";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_CATEGORIES = [
  "patient-photos",
  "documents",
  "lab-results",
] as const;

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export async function POST(req: NextRequest) {
  // ---------- Auth ----------
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ---------- Parse multipart form data ----------
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid form data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  const category = formData.get("category") as string | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file field" },
      { status: 400 },
    );
  }

  // ---------- Validate category ----------
  if (
    !category ||
    !(ALLOWED_CATEGORIES as readonly string[]).includes(category)
  ) {
    return NextResponse.json(
      {
        error: `Invalid category. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // ---------- Validate MIME type ----------
  const mimeType = file.type;
  if (!ALLOWED_MIME_TYPES[mimeType]) {
    return NextResponse.json(
      {
        error: `File type not allowed. Accepted: ${Object.keys(ALLOWED_MIME_TYPES).join(", ")}`,
      },
      { status: 400 },
    );
  }

  // ---------- Validate size ----------
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds maximum size of 10 MB" },
      { status: 400 },
    );
  }

  // ---------- Build S3 key ----------
  const practiceId = session.user.practiceId;
  const uuid = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${practiceId}/${category}/${uuid}-${safeName}`;

  // ---------- Upload ----------
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadFile(key, buffer, mimeType);

    // Persist metadata in the database
    await db.insert(files).values({
      practiceId,
      uploadedBy: session.user.id,
      fileName: file.name,
      fileKey: key,
      fileUrl: url,
      mimeType,
      fileSizeBytes: file.size,
      category,
    });

    return NextResponse.json({ url, key }, { status: 201 });
  } catch (err) {
    console.error("Upload failed:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 },
    );
  }
}
