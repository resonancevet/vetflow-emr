"use client";

import { useRouter } from "next/navigation";
import {
  ClipboardList,
  FileText,
  Mail,
  Phone,
  Receipt,
  CalendarPlus,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

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
  other: {
    label: "Task",
    icon: ClipboardList,
    className: "bg-muted text-muted-foreground",
  },
};

export function TaskListCard() {
  const router = useRouter();
  const { data, isLoading, isError, error } = trpc.dashboard.listTasks.useQuery();
  const tasks = data ?? [];

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Task List</h2>
          <p className="text-xs text-muted-foreground">
            Invoices, SOAPs, mailings, follow-ups, and calls that still need
            attention
          </p>
        </div>
        {tasks.length > 0 && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {tasks.length}
          </span>
        )}
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
              <button
                key={task.id}
                type="button"
                onClick={() => router.push(task.href)}
                className="flex w-full items-start gap-3 rounded-md border border-border px-4 py-3 text-left transition-colors hover:bg-muted/50"
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
            );
          })
        )}
      </div>
    </div>
  );
}
