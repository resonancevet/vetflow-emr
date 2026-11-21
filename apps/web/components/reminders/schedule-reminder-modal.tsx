"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dueAtFromDateInput(dateStr: string): Date {
  // Noon local avoids timezone edge cases around midnight.
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

type Props = {
  open: boolean;
  onClose: () => void;
  patientId?: string;
  clientId?: string;
  defaultTitle?: string;
  contextLabel?: string;
};

export function ScheduleReminderModal({
  open,
  onClose,
  patientId,
  clientId,
  defaultTitle = "",
  contextLabel,
}: Props) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(defaultTitle);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toDateInputValue(d);
  });

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setNotes("");
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDueDate(toDateInputValue(d));
  }, [open, defaultTitle]);

  const create = trpc.staffReminders.create.useMutation({
    onSuccess: () => {
      utils.dashboard.listTasks.invalidate();
      utils.staffReminders.listOpen.invalidate();
      toast.success("Reminder scheduled");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-reminder-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2
            id="schedule-reminder-title"
            className="font-heading text-lg font-semibold"
          >
            Schedule reminder
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) {
              toast.error("Please enter a reminder title");
              return;
            }
            if (!dueDate) {
              toast.error("Please choose a due date");
              return;
            }
            const dueAt = dueAtFromDateInput(dueDate);
            if (Number.isNaN(dueAt.getTime())) {
              toast.error("Invalid due date");
              return;
            }
            create.mutate({
              title: title.trim(),
              notes: notes.trim() || undefined,
              dueAt,
              patientId,
              clientId,
            });
          }}
        >
          {contextLabel ? (
            <p className="text-sm text-muted-foreground">
              For{" "}
              <span className="font-medium text-foreground">{contextLabel}</span>
            </p>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Reminder *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Follow up on lab results"
              maxLength={255}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Due date *</label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Appears on your Task List on this date (and stays until completed).
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Notes</label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details"
              maxLength={5000}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Bell className="mr-2 h-4 w-4" />
              )}
              Schedule
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function StaffRemindersPanel({
  patientId,
  clientId,
}: {
  patientId?: string;
  clientId?: string;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.staffReminders.listOpen.useQuery({
    patientId,
    clientId,
    includeUpcoming: true,
  });

  const complete = trpc.staffReminders.complete.useMutation({
    onSuccess: () => {
      utils.dashboard.listTasks.invalidate();
      utils.staffReminders.listOpen.invalidate();
      toast.success("Reminder completed");
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = trpc.staffReminders.remove.useMutation({
    onSuccess: () => {
      utils.dashboard.listTasks.invalidate();
      utils.staffReminders.listOpen.invalidate();
      toast.success("Reminder deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading reminders…</p>;
  }

  const items = data ?? [];
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No open reminders for this record.
      </p>
    );
  }

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const due = item.dueAt ? new Date(item.dueAt) : null;
        const isDue = due ? due.getTime() <= todayEnd.getTime() : false;
        return (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-md border border-border px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                Due{" "}
                {due
                  ? due.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
                {isDue ? " · on task list" : " · upcoming"}
                {item.notes ? ` — ${item.notes}` : ""}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={complete.isPending}
              onClick={() => complete.mutate({ id: item.id })}
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Done
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="shrink-0"
              disabled={remove.isPending}
              onClick={() => {
                if (!window.confirm("Delete this reminder?")) return;
                remove.mutate({ id: item.id });
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
