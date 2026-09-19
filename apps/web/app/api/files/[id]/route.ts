import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { and, eq, isNull } from "drizzle-orm";
import { authOptions } from "@/lib/auth";
import { db } from "@openpims/db/client";
import { files } from "@openpims/db";
import { getObject, storageErrorMessage } from "@/lib/s3";

/**
 * Stream a stored attachment back to the browser. We do this through the app
 * (rather than handing out a presigned S3 URL) so:
 *   - Mobile devices on the LAN can load files; presigned URLs include the
 *     storage hostname (e.g. `localhost:9000`) which only resolves on the
 *     laptop running the dev stack.
 *   - We can re-check practice scope on every fetch instead of trusting a
 *     pre-signed URL that lives for an hour.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .select({
      fileKey: files.fileKey,
      fileName: files.fileName,
      mimeType: files.mimeType,
      content: files.content,
    })
    .from(files)
    .where(
      and(
        eq(files.id, params.id),
        eq(files.practiceId, session.user.practiceId),
        isNull(files.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const safeName = row.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Prefer inline DB bytes when present (fallback path when object storage
  // was unavailable at upload time, or after a backfill).
  if (row.content && row.content.length > 0) {
    return new Response(new Uint8Array(row.content), {
      headers: {
        "Content-Type": row.mimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  try {
    const obj = await getObject(row.fileKey);
    if (!obj.Body) {
      return NextResponse.json({ error: "Empty body" }, { status: 500 });
    }

    // AWS SDK v3 bodies expose transformToWebStream() — use it directly so we
    // can stream the response without buffering the whole file in memory.
    const body = obj.Body as {
      transformToWebStream: () => ReadableStream;
    };

    return new Response(body.transformToWebStream(), {
      headers: {
        "Content-Type":
          row.mimeType ?? obj.ContentType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeName}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("File fetch failed:", err);
    return NextResponse.json(
      { error: storageErrorMessage(err) },
      { status: 500 },
    );
  }
}
