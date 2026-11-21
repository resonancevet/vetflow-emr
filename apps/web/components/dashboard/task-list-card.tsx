"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  ClipboardList,
  FileText,
  Loader2,
  Mail,
  Phone,
  Receipt,
  CalendarPlus,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScheduleReminderModal } from "@/components/reminders/schedule-reminder-modal";

const categoryMeta: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  invoice: {
    label: "Invoice",
    icon: Receipt,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  },
  soap: {
    label: "SOAP",
    icon: FileText,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  mailing: {
    label: "Mailing",
    icon: Mail,
    className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  },
  follow_up: {
    label: "Follow-up",
    icon: CalendarPlus,
    className: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  },
  phone: {
    label: "Call",
    icon: Phone,
    className: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  },
  reminder: {
    label: "Reminder",
    icon: Bell,
    className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  },
  other: {
    label: "Task",
    icon: ClipboardList,
    className: "bg-muted text-muted-foreground",
  },
};

export function TaskListCard() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const { data, isLoading, isError, error } = trpc.dashboard.listTasks.useQuery();
  const tasks = data ?? [];

  const completeReminder = trpc.staffReminders.complete.useMutation({
    onSuccess: () => {
      utils.dashboard.listTasks.invalidate();
      utils.staffReminders.listOpen.invalidate();
      toast.success("Reminder completed");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Task List</h2>
          <p className="text-xs text-muted-foreground">
            Invoices, SOAPs, mailings, follow-ups, reminders, and calls that
            still need attention
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {tasks.length > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {tasks.length}
            </span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setScheduleOpen(true)}
          >
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            New Task
          </Button>
        </div>
      </div>
      <div className="space-y-2 p-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="py-6 text-center text-sm text-destructive">
            {error.message}
          </p>
        ) : tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No open tasks right now.
          </p>
        ) : (
          tasks.map((task) => {
            const meta = categoryMeta[task.category] ?? categoryMeta.other;
            const Icon = meta.icon;
            return (
              <div
                key={task.id}
                className="flex w-full items-start gap-3 rounded-md border border-border px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <button
                  type="button"
                  onClick={() => router.push(task.href)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                      meta.className
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{task.title}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          meta.className
                        )}
                      >
                        {meta.label}
                      </span>
                    </span>
                    {task.subtitle ? (
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {task.subtitle}
                      </span>
                    ) : null}
                  </span>
                </button>
                {task.reminderId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={completeReminder.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      completeReminder.mutate({ id: task.reminderId! });
                    }}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Done
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <ScheduleReminderModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />
    </div>
  );
}
