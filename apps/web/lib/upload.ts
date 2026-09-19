const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * Re-encode an image as JPEG when the browser can decode it.
 * Covers iPhone HEIC (Safari), empty MIME types, and odd aliases so the
 * upload API's allowlist doesn't reject field photos.
 */
export async function normalizeImageForUpload(file: File): Promise<File> {
  if (ALLOWED_IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_BYTES) {
    return file;
  }

  const looksHeic =
    /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      throw new Error("Could not process image");
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) throw new Error("Could not convert image");
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error("File exceeds maximum size of 10 MB");
    }

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch (err) {
    if (err instanceof Error && err.message.includes("10 MB")) throw err;
    if (looksHeic) {
      throw new Error(
        "HEIC photos aren't supported on this device. Export or share the photo as JPEG and try again.",
      );
    }
    throw new Error(
      file.type
        ? `File type not allowed (${file.type}). Use JPEG, PNG, or WebP.`
        : "Couldn't read this image. Use JPEG, PNG, or WebP.",
    );
  }
}

export async function uploadFileToApi(
  file: File,
  options: {
    category: string;
    entityType?: string;
    entityId?: string;
  },
): Promise<{ id?: string; url: string; key: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", options.category);
  if (options.entityType) formData.append("entityType", options.entityType);
  if (options.entityId) formData.append("entityId", options.entityId);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Upload failed");
  }

  return res.json();
}
