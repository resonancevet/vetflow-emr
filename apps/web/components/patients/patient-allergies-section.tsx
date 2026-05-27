"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Allergy = {
  id: string;
  allergen: string;
  reaction: string | null;
  severity: "mild" | "moderate" | "severe";
  notedAt: Date | string | null;
  updatedAt?: Date | string | null;
};

const severityClass: Record<Allergy["severity"], string> = {
  severe:
    "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200",
  moderate:
    "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  mild: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

export function PatientAllergiesSection({
  patientId,
  allergies,
  canManage,
}: {
  patientId: string;
  allergies: Allergy[];
  canManage: boolean;
}) {
  const utils = trpc.useUtils();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    allergen: "",
    reaction: "",
    severity: "moderate" as Allergy["severity"],
  });
  const [editSnapshot, setEditSnapshot] = useState<{
    updatedAt?: Date | string | null;
  }>({});

  const invalidate = () => utils.patients.getById.invalidate({ id: patientId });

  const addAllergy = trpc.patients.addAllergy.useMutation({
    onSuccess: () => {
      toast.success("Allergy added");
      setAdding(false);
      setForm({ allergen: "", reaction: "", severity: "moderate" });
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateAllergy = trpc.patients.updateAllergy.useMutation({
    onSuccess: () => {
      toast.success("Allergy updated");
      setEditingId(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAllergy = trpc.patients.deleteAllergy.useMutation({
    onSuccess: () => {
      toast.success("Allergy removed");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const startEdit = (a: Allergy) => {
    setEditingId(a.id);
    setForm({
      allergen: a.allergen,
      reaction: a.reaction ?? "",
      severity: a.severity,
    });
    setEditSnapshot({ updatedAt: a.updatedAt });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Allergies</h3>
        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add allergy
          </Button>
        )}
      </div>

      {adding && canManage && (
        <form
          className="mt-4 space-y-3 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            addAllergy.mutate({
              patientId,
              allergen: form.allergen.trim(),
              reaction: form.reaction.trim() || undefined,
              severity: form.severity,
            });
          }}
        >
          <Input
            placeholder="Allergen"
            value={form.allergen}
            onChange={(e) => setForm((f) => ({ ...f, allergen: e.target.value }))}
            required
            className="min-h-11"
          />
          <Input
            placeholder="Reaction (optional)"
            value={form.reaction}
            onChange={(e) => setForm((f) => ({ ...f, reaction: e.target.value }))}
            className="min-h-11"
          />
          <select
            value={form.severity}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                severity: e.target.value as Allergy["severity"],
              }))
            }
            className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={addAllergy.isPending} className="min-h-11">
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)} className="min-h-11">
              Cancel
            </Button>
          </div>
        </form>
      )}

      {allergies.length === 0 && !adding ? (
        <p className="mt-3 text-sm text-muted-foreground">No allergies recorded.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {allergies.map((a) =>
            editingId === a.id ? (
              <li key={a.id} className="space-y-2 rounded-md border border-border p-3">
                <Input
                  value={form.allergen}
                  onChange={(e) => setForm((f) => ({ ...f, allergen: e.target.value }))}
                  className="min-h-11"
                />
                <Input
                  value={form.reaction}
                  onChange={(e) => setForm((f) => ({ ...f, reaction: e.target.value }))}
                  placeholder="Reaction"
                  className="min-h-11"
                />
                <select
                  value={form.severity}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      severity: e.target.value as Allergy["severity"],
                    }))
                  }
                  className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11"
                    onClick={() =>
                      updateAllergy.mutate({
                        id: a.id,
                        allergen: form.allergen.trim(),
                        reaction: form.reaction.trim() || undefined,
                        severity: form.severity,
                        clientUpdatedAt: editSnapshot.updatedAt
                          ? new Date(editSnapshot.updatedAt)
                          : undefined,
                      })
                    }
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditingId(null)} className="min-h-11">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ) : (
              <li
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border p-3"
              >
                <div>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                      severityClass[a.severity]
                    )}
                  >
                    {a.allergen}
                    {a.severity === "severe" ? " (!)" : ""}
                  </span>
                  {a.reaction && (
                    <p className="mt-1 text-sm text-muted-foreground">{a.reaction}</p>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(a)}
                      className="rounded p-2 hover:bg-accent min-h-11 min-w-11 flex items-center justify-center"
                      aria-label="Edit allergy"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Remove this allergy?")) {
                          deleteAllergy.mutate({ id: a.id });
                        }
                      }}
                      className="rounded p-2 text-destructive hover:bg-destructive/10 min-h-11 min-w-11 flex items-center justify-center"
                      aria-label="Delete allergy"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}
