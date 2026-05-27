"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Channel = "phone" | "sms" | "email" | "portal";
type Direction = "inbound" | "outbound";

export type CommunicationListItem = {
  id: string;
  channel: Channel;
  direction: Direction;
  subject: string | null;
  content: string | null;
  createdAt: Date | string | null;
  updatedAt?: Date | string | null;
  patientId?: string | null;
  patientName?: string | null;
  assignedName?: string | null;
};

type EditingItem = {
  id: string;
  channel: Channel;
  direction: Direction;
  subject: string | null;
  content: string | null;
  patientId: string | null;
  updatedAt?: Date | string | null;
};

export function LogCommunicationModal({
  open,
  onClose,
  clientId,
  patientId,
  clientLabel,
  editingItem,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  clientId: string;
  patientId?: string;
  clientLabel?: string;
  editingItem?: EditingItem | null;
  onSuccess?: () => void;
}) {
  const utils = trpc.useUtils();
  const isEditing = !!editingItem;
  const [channel, setChannel] = useState<Channel>("phone");
  const [direction, setDirection] = useState<Direction>("outbound");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [linkPatientId, setLinkPatientId] = useState(patientId ?? "");

  const { data: client } = trpc.clients.getById.useQuery(
    { id: clientId },
    { enabled: open && !!clientId }
  );

  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setChannel(editingItem.channel);
      setDirection(editingItem.direction);
      setSubject(editingItem.subject ?? "");
      setContent(editingItem.content ?? "");
      setLinkPatientId(editingItem.patientId ?? patientId ?? "");
    } else {
      setLinkPatientId(patientId ?? "");
      setChannel("phone");
      setDirection("outbound");
      setSubject("");
      setContent("");
    }
  }, [open, patientId, editingItem]);

  const invalidateAll = () => {
    utils.communications.getByClient.invalidate({ clientId });
    if (patientId || linkPatientId) {
      utils.communications.getByPatient.invalidate({
        patientId: patientId ?? linkPatientId,
      });
    }
    if (editingItem?.patientId && editingItem.patientId !== linkPatientId) {
      utils.communications.getByPatient.invalidate({
        patientId: editingItem.patientId,
      });
    }
  };

  const create = trpc.communications.create.useMutation({
    onSuccess: () => {
      toast.success("Communication logged");
      invalidateAll();
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.communications.update.useMutation({
    onSuccess: () => {
      toast.success("Communication updated");
      invalidateAll();
      onSuccess?.();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!open) return null;

  const patients = client?.patients ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-comm-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="log-comm-title" className="font-heading text-lg font-semibold">
            {isEditing ? "Edit communication" : "Log communication"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 hover:bg-accent min-h-11 min-w-11 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!content.trim()) {
              toast.error("Please enter what was discussed");
              return;
            }
            if (isEditing && editingItem) {
              update.mutate({
                id: editingItem.id,
                channel,
                direction,
                subject: subject.trim() || undefined,
                content: content.trim(),
                patientId: linkPatientId || null,
                clientUpdatedAt: editingItem.updatedAt
                  ? new Date(editingItem.updatedAt)
                  : undefined,
              });
            } else {
              create.mutate({
                clientId,
                patientId: linkPatientId || undefined,
                channel,
                direction,
                subject: subject.trim() || undefined,
                content: content.trim(),
                status: "read",
              });
            }
          }}
        >
          {clientLabel && (
            <p className="text-sm text-muted-foreground">
              Client: <span className="font-medium text-foreground">{clientLabel}</span>
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Channel</label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as Channel)}
                className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="phone">Phone</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="portal">Portal</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Direction</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as Direction)}
                className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
          </div>

          {!patientId && patients.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium">
                Related patient (optional)
              </label>
              <select
                value={linkPatientId}
                onChange={(e) => setLinkPatientId(e.target.value)}
                className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">None — client only</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium">Subject (optional)</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Post-visit follow-up"
              className="min-h-11"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">Notes *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              required
              placeholder="What was discussed?"
              className="w-full min-h-[8rem] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="submit"
              disabled={create.isPending || update.isPending}
              className="min-h-11"
            >
              {(create.isPending || update.isPending)
                ? "Saving..."
                : isEditing
                  ? "Save changes"
                  : "Save to record"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="min-h-11">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const channelLabels: Record<Channel, string> = {
  phone: "Phone",
  sms: "SMS",
  email: "Email",
  portal: "Portal",
};

export function CommunicationList({
  items,
  emptyMessage = "No communications logged yet.",
  onEdit,
  canManage = true,
  clientId,
}: {
  items: CommunicationListItem[];
  emptyMessage?: string;
  onEdit?: (item: CommunicationListItem) => void;
  canManage?: boolean;
  clientId?: string;
}) {
  const utils = trpc.useUtils();
  const deleteComm = trpc.communications.delete.useMutation({
    onSuccess: () => {
      toast.success("Communication deleted");
      if (clientId) {
        utils.communications.getByClient.invalidate({ clientId });
      }
      utils.communications.getByPatient.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {channelLabels[item.channel]}
            </span>
            <span aria-hidden>·</span>
            <span className={cn(item.direction === "inbound" ? "text-blue-600" : "text-emerald-600")}>
              {item.direction === "inbound" ? "Inbound" : "Outbound"}
            </span>
            {item.patientName && (
              <>
                <span aria-hidden>·</span>
                <span>Re: {item.patientName}</span>
              </>
            )}
            <span className="ml-auto">
              {item.createdAt
                ? new Date(item.createdAt).toLocaleString()
                : ""}
            </span>
            {canManage && (
              <div className="flex items-center gap-1">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="rounded p-2 hover:bg-accent min-h-11 min-w-11 flex items-center justify-center"
                    aria-label="Edit communication"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Delete this communication?")) {
                      deleteComm.mutate({ id: item.id });
                    }
                  }}
                  className="rounded p-2 text-destructive hover:bg-destructive/10 min-h-11 min-w-11 flex items-center justify-center"
                  aria-label="Delete communication"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {item.subject && (
            <p className="mt-2 text-sm font-medium">{item.subject}</p>
          )}
          <p className="mt-1 text-sm whitespace-pre-wrap">{item.content}</p>
          {item.assignedName && (
            <p className="mt-2 text-xs text-muted-foreground">
              Logged by {item.assignedName}
              {item.updatedAt && item.createdAt &&
                new Date(item.updatedAt).getTime() -
                  new Date(item.createdAt).getTime() >
                  1000 && (
                  <span className="ml-2 italic">
                    · edited {new Date(item.updatedAt).toLocaleString()}
                  </span>
                )}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
