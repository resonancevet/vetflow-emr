import { randomUUID } from "crypto";
import { files } from "@openpims/db";
import { uploadFile } from "@/lib/s3";

type StorePracticeFileOpts = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  practiceId: string;
  uploadedBy: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  category: string;
  entityType?: string;
  entityId?: string;
};

/** Persist a generated PDF (S3 when available, else DB bytea) and return file row. */
export async function storePracticeFile(opts: StorePracticeFileOpts) {
  const rawName = opts.fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "file.pdf";
  const extMatch = rawName.match(/(\.[a-zA-Z0-9]{1,8})$/);
  const ext = extMatch?.[1] ?? ".pdf";
  const withoutExt = ext ? rawName.slice(0, -ext.length) : rawName;
  const base = withoutExt.slice(0, Math.max(1, 80 - ext.length)) || "file";
  const safeName = `${base}${ext}`;
  const key = `${opts.practiceId}/${opts.category}/${randomUUID()}-${safeName}`;

  let url: string;
  let content: Buffer | null = null;
  try {
    url = await uploadFile(key, opts.buffer, opts.mimeType);
  } catch (storageErr) {
    console.error(
      "Object storage upload failed; storing file in database:",
      storageErr
    );
    url = "db-store";
    content = opts.buffer;
  }

  const [fileRow] = await opts.db
    .insert(files)
    .values({
      practiceId: opts.practiceId,
      uploadedBy: opts.uploadedBy,
      fileName: opts.fileName.slice(0, 255),
      fileKey: key,
      fileUrl: url,
      mimeType: opts.mimeType,
      fileSizeBytes: opts.buffer.length,
      category: opts.category,
      entityType: opts.entityType ?? null,
      entityId: opts.entityId ?? null,
      content,
    })
    .returning({
      id: files.id,
      fileUrl: files.fileUrl,
      fileName: files.fileName,
    });

  const id = fileRow!.id as string;
  return {
    id,
    fileName: fileRow!.fileName as string,
    fileUrl: `/api/files/${id}`,
  };
}
