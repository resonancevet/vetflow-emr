"use client";

import { FileText } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { generateRabiesSwornStatementPdf } from "@/lib/rabies-pdf";
import { Button } from "@/components/ui/button";

export function AppointmentPrepChecklist({
  appointmentId,
  patientName,
  clientName,
  items,
}: {
  appointmentId: string;
  patientName: string;
  clientName: string;
  items: Array<{
    id: string;
    key: string;
    label: string;
    completedAt: Date | string | null;
  }>;
}) {
  const utils = trpc.useUtils();
  const setItem = trpc.visitChecklists.setItemCompleted.useMutation({
    onSuccess: () => {
      void utils.visitChecklists.listPrepForAppointments.invalidate();
      void utils.dashboard.listTasks.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (items.length === 0) return null;

  async function printStatement() {
    try {
      const doc = generateRabiesSwornStatementPdf({
        ownerName: clientName || undefined,
        patientName,
      });
      doc.save(
        `rabies_sworn_statement_${patientName.replace(/\s+/g, "_")}.pdf`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate statement"
      );
    }
  }

  const hasRabiesStatement = items.some(
    (i) => i.key === "pre_rabies_client_statement"
  );

  return (
    <div className="mt-2 border-t border-border/70 pt-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Prep / pack list
        </p>
        {hasRabiesStatement && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => void printStatement()}
          >
            <FileText className="mr-1 h-3.5 w-3.5" />
            Print statement
          </Button>
        )}
      </div>
      <ul className="space-y-1" data-appointment-id={appointmentId}>
        {items.map((item) => {
          const checked = Boolean(item.completedAt);
          return (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  disabled={setItem.isPending}
                  onChange={() =>
                    setItem.mutate({
                      itemId: item.id,
                      completed: !checked,
                    })
                  }
                />
                <span
                  className={cn(
                    checked && "text-muted-foreground line-through"
                  )}
                >
                  {item.label}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
