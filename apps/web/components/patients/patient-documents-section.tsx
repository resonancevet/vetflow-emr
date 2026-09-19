"use client";

import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { normalizeImageForUpload, uploadFileToApi } from "@/lib/upload";

export function PatientDocumentsSection({
  patientId,
  canManage,
}: {
  patientId: string;
  canManage: boolean;
}) {
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: files, isLoading } = trpc.records.listFilesForEntity.useQuery({
    entityType: "patient",
    entityId: patientId,
  });

  const documents = (files ?? []).filter(
    (f) => f.category === "documents" || f.category === "lab-results",
  );

  const deleteFile = trpc.records.deleteFile.useMutation({
    onSuccess: () => {
      toast.success("Document removed");
      utils.records.listFilesForEntity.invalidate({
        entityType: "patient",
        entityId: patientId,
      });
    },
    onError: (err) => toast.error(err.message),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    setUploading(true);
    try {
      for (const file of selected) {
        const toUpload = file.type.startsWith("image/")
          ? await normalizeImageForUpload(file)
          : file;
        await uploadFileToApi(toUpload, {
          category: "documents",
          entityType: "patient",
          entityId: patientId,
        });
      }
      toast.success(
        selected.length === 1 ? "Document uploaded" : "Documents uploaded",
      );
      utils.records.listFilesForEntity.invalidate({
        entityType: "patient",
        entityId: patientId,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Prior records, referral letters, outside lab PDFs, and other chart
          files — no SOAP note required.
        </p>
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {uploading ? "Uploading..." : "Upload document"}
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents...</p>
      ) : documents.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No documents yet. Upload prior medical records as PDF or images.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm font-medium text-primary hover:underline"
                  >
                    {file.fileName}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {file.createdAt
                      ? new Date(file.createdAt).toLocaleDateString()
                      : ""}
                    {file.category === "lab-results" ? " · Lab result" : ""}
                  </p>
                </div>
              </div>
              {canManage && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:text-destructive"
                  disabled={deleteFile.isPending}
                  onClick={() => {
                    if (
                      confirm(`Remove “${file.fileName}” from this patient?`)
                    ) {
                      deleteFile.mutate({ id: file.id });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
