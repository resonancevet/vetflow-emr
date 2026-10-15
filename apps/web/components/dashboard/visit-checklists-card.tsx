"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardCheck, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { generateRabiesSwornStatementPdf } from "@/lib/rabies-pdf";

export function VisitChecklistsCard() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.visitChecklists.listForDashboard.useQuery({
    daysAhead: 2,
  });
  const setItem = trpc.visitChecklists.setItemCompleted.useMutation({
    onSuccess: () => {
      void utils.visitChecklists.listForDashboard.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = data ?? [];
  const preRows = rows.filter((r) => r.preDone < r.preTotal);
  const postRows = rows.filter((r) => r.postDone < r.postTotal);

  async function printSwornStatement(opts: {
    patientName: string;
    clientName: string;
  }) {
    try {
      const doc = generateRabiesSwornStatementPdf({
        ownerName: opts.clientName || undefined,
        patientName: opts.patientName,
      });
      doc.save(
        `rabies_sworn_statement_${opts.patientName.replace(/\s+/g, "_")}.pdf`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate statement"
      );
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium">Rabies visit checklists</p>
          <p className="text-xs text-muted-foreground">
            Pre-visit pack list and post-visit close-out for mobile visits
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rabies checklists for today or the next two days. Mark “Rabies
          planned” on an appointment or schedule a patient due for rabies.
        </p>
      ) : (
        <div className="space-y-5">
          <ChecklistSection
            title="Pre-visit"
            empty="All pre-visit items complete"
            rows={preRows.length > 0 ? preRows : rows.filter((r) => r.preTotal > 0).slice(0, 3)}
            showOnlyIncomplete={preRows.length > 0}
            phase="pre"
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onToggle={(itemId, completed) =>
              setItem.mutate({ itemId, completed })
            }
            onPrintStatement={printSwornStatement}
            pending={setItem.isPending}
          />
          <ChecklistSection
            title="Post-visit"
            empty="No open post-visit close-outs"
            rows={postRows}
            showOnlyIncomplete
            phase="post"
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onToggle={(itemId, completed) =>
              setItem.mutate({ itemId, completed })
            }
            onPrintStatement={printSwornStatement}
            pending={setItem.isPending}
          />
        </div>
      )}
    </div>
  );
}

function ChecklistSection({
  title,
  empty,
  rows,
  showOnlyIncomplete,
  phase,
  expandedId,
  setExpandedId,
  onToggle,
  onPrintStatement,
  pending,
}: {
  title: string;
  empty: string;
  rows: Array<{
    checklistId: string;
    appointmentId: string;
    patientId: string;
    patientName: string;
    clientName: string;
    startTime: Date | string;
    preTotal: number;
    preDone: number;
    postTotal: number;
    postDone: number;
    items: Array<{
      id: string;
      phase: "pre" | "post";
      key: string;
      label: string;
      completedAt: Date | string | null;
    }>;
  }>;
  showOnlyIncomplete?: boolean;
  phase: "pre" | "post";
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onToggle: (itemId: string, completed: boolean) => void;
  onPrintStatement: (row: {
    patientName: string;
    clientName: string;
  }) => void;
  pending: boolean;
}) {
  const visible = showOnlyIncomplete
    ? rows.filter((r) =>
        phase === "pre" ? r.preDone < r.preTotal : r.postDone < r.postTotal
      )
    : rows;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => {
            const done = phase === "pre" ? row.preDone : row.postDone;
            const total = phase === "pre" ? row.preTotal : row.postTotal;
            const key = `${row.checklistId}-${phase}`;
            const open = expandedId === key;
            const when = new Date(row.startTime).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <li
                key={key}
                className="rounded-md border border-border px-3 py-2"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-2 text-left"
                  onClick={() => setExpandedId(open ? null : key)}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {row.patientName}
                      {row.clientName ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {row.clientName}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{when}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {done}/{total}
                  </span>
                </button>
                {open && (
                  <div className="mt-2 space-y-2 border-t border-border pt-2">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/patients/${row.patientId}`}>
                          Open chart
                        </Link>
                      </Button>
                      {phase === "pre" && (
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => onPrintStatement(row)}
                        >
                          <FileText className="mr-1 h-3.5 w-3.5" />
                          Print sworn statement
                        </Button>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {row.items
                        .filter((item) => item.phase === phase)
                        .map((item) => {
                          const checked = Boolean(item.completedAt);
                          return (
                            <li key={item.id}>
                              <label className="flex cursor-pointer items-start gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={checked}
                                  disabled={pending}
                                  onChange={() =>
                                    onToggle(item.id, !checked)
                                  }
                                />
                                <span
                                  className={
                                    checked
                                      ? "text-muted-foreground line-through"
                                      : undefined
                                  }
                                >
                                  {item.label}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                    </ul>
                    {phase === "post" && (
                      <p className="text-xs text-muted-foreground">
                        Upload the signed sworn statement under patient
                        Documents, then check that item. Certificate generate +
                        file are checked automatically after rabies admin.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
