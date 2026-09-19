import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { uploadFile, storageErrorMessage } from "@/lib/s3";
import { db } from "@openpims/db/client";
import { files } from "@openpims/db";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_CATEGORIES = [
  "patient-photos",
  "soap-attachments",
  "documents",
  "lab-results",
  "cage-chart",
  "dental-chart",
  "surgical-report",
  "anesthesia-monitor",
  "discharge-pdf",
] as const;

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
};

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function sniffMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") {
    return "application/pdf";
  }
  // HEIC/HEIF often starts with ....ftypheic / ftypheif / ftypmif1
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12).toLowerCase();
    if (
      brand.startsWith("heic") ||
      brand.startsWith("heif") ||
      brand.startsWith("mif1") ||
      brand.startsWith("msf1")
    ) {
      return "image/heic";
    }
  }
  return null;
}

function resolveMimeType(file: File, buffer: Buffer): string | null {
  const raw = (file.type || "").toLowerCase().trim();
  const aliased = MIME_ALIASES[raw] ?? raw;
  if (ALLOWED_MIME_TYPES[aliased]) return aliased;
  if (aliased === "image/heic" || aliased === "image/heif") return "image/heic";

  const ext = extensionOf(file.name);
  if (ext === ".heic" || ext === ".heif") return "image/heic";
  if (MIME_BY_EXT[ext] && ALLOWED_MIME_TYPES[MIME_BY_EXT[ext]]) {
    return MIME_BY_EXT[ext];
  }

  return sniffMime(buffer);
}

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
  const entityType = formData.get("entityType") as string | null;
  const entityId = formData.get("entityId") as string | null;

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

  // ---------- Validate size ----------
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds maximum size of 10 MB" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = resolveMimeType(file, buffer);

  if (mimeType === "image/heic") {
    return NextResponse.json(
      {
        error:
          "HEIC photos aren't supported. Export or share the photo as JPEG and try again.",
      },
      { status: 400 },
    );
  }

  if (!mimeType || !ALLOWED_MIME_TYPES[mimeType]) {
    return NextResponse.json(
      {
        error: `File type not allowed. Accepted: ${Object.keys(ALLOWED_MIME_TYPES).join(", ")}`,
      },
      { status: 400 },
    );
  }

  // ---------- Build S3 key ----------
  const practiceId = session.user.practiceId;
  const uuid = randomUUID();
  // Keep keys/names short so varchar(255/512) columns and R2 URLs stay valid.
  const rawName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload";
  const extMatch = rawName.match(/(\.[a-zA-Z0-9]{1,8})$/);
  const ext = extMatch?.[1] ?? "";
  const withoutExt = ext ? rawName.slice(0, -ext.length) : rawName;
  const base = (withoutExt.slice(0, Math.max(1, 80 - ext.length)) || "upload");
  const safeName = `${base}${ext}`;
  const storedName = file.name.slice(0, 255);
  const key = `${practiceId}/${category}/${uuid}-${safeName}`;

  // ---------- Upload (object storage, with DB byte fallback) ----------
  try {
    let url: string;
    let content: Buffer | null = null;

    try {
      url = await uploadFile(key, buffer, mimeType);
    } catch (storageErr) {
      // Host env often lacks working R2/S3 credentials (common on fresh Vercel
      // projects). Keep the upload working by storing bytes in Postgres and
      // serving them through /api/files.
      console.error(
        "Object storage upload failed; storing file in database:",
        storageErr,
      );
      url = "db-store";
      content = buffer;
    }

    const [fileRow] = await db
      .insert(files)
      .values({
        practiceId,
        uploadedBy: session.user.id,
        fileName: storedName,
        fileKey: key,
        fileUrl: url,
        mimeType,
        fileSizeBytes: file.size,
        category,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        content,
      })
      .returning({ id: files.id });

    return NextResponse.json(
      { id: fileRow!.id, url, key, entityType, entityId },
      { status: 201 },
    );
  } catch (err) {
    console.error("Upload failed:", err);
    return NextResponse.json(
      { error: storageErrorMessage(err) },
      { status: 500 },
    );
  }
}
