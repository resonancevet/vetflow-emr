export async function uploadFileToApi(
  file: File,
  options: {
    category: string;
    entityType?: string;
    entityId?: string;
  }
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
