"use client";

import { useState } from "react";
import { AlertTriangle, Bell, Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AlertType = "behavior" | "medical" | "financial" | "other";
type AllergySeverity = "mild" | "moderate" | "severe";

const allergyBanner: Record<AllergySeverity, string> = {
  severe:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  moderate:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  mild: "border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200",
};

/**
 * Financial alerts moved to client-level (see `client_alerts`). We keep the
 * enum value in the DB for back-compat but hide it from the create/edit UI.
 */
const visibleAlertTypes: AlertType[] = ["behavior", "medical", "other"];
type AlertSeverity = "info" | "warning" | "critical";

const severityOrder: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const severityBanner: Record<AlertSeverity, string> = {
  critical:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  warning:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
};

export function PatientAlertsManageButton({
  patientId,
}: {
  patientId: string;
}) {
  const utils = trpc.useUtils();
  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAllergyId, setEditingAllergyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingAllergy, setAddingAllergy] = useState(false);
  const [allergyForm, setAllergyForm] = useState({
    allergen: "",
    reaction: "",
    severity: "moderate" as AllergySeverity,
  });
  const [form, setForm] = useState({
    type: "behavior" as AlertType,
    severity: "warning" as AlertSeverity,
    title: "",
    notes: "",
    expiresAt: "",
  });
  const [editSnapshot, setEditSnapshot] = useState<{
    updatedAt?: Date | string | null;
  }>({});

  const { data: alerts = [] } = trpc.patientAlerts.list.useQuery({
    patientId,
    activeOnly: true,
  });
  const { data: patient } = trpc.patients.getById.useQuery(
    { id: patientId },
    { enabled: manageOpen }
  );
  const allergies = patient?.allergies ?? [];

  const sorted = [...alerts].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  const invalidate = () =>
    utils.patientAlerts.list.invalidate({ patientId, activeOnly: true });
  const invalidateAllergies = () =>
    utils.patients.getById.invalidate({ id: patientId });

  const create = trpc.patientAlerts.create.useMutation({
    onSuccess: () => {
      toast.success("Alert added");
      setAdding(false);
      setForm({
        type: "behavior",
        severity: "warning",
        title: "",
        notes: "",
        expiresAt: "",
      });
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const update = trpc.patientAlerts.update.useMutation({
    onSuccess: () => {
      toast.success("Alert updated");
      setEditingId(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.patientAlerts.delete.useMutation({
    onSuccess: () => {
      toast.success("Alert removed");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const addAllergy = trpc.patients.addAllergy.useMutation({
    onSuccess: () => {
      toast.success("Allergy added");
      setAddingAllergy(false);
      setAllergyForm({ allergen: "", reaction: "", severity: "moderate" });
      invalidateAllergies();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateAllergy = trpc.patients.updateAllergy.useMutation({
    onSuccess: () => {
      toast.success("Allergy updated");
      setEditingAllergyId(null);
      invalidateAllergies();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAllergy = trpc.patients.deleteAllergy.useMutation({
    onSuccess: () => {
      toast.success("Allergy removed");
      invalidateAllergies();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 shrink-0"
        onClick={() => setManageOpen(true)}
      >
        <Bell className="mr-2 h-4 w-4" />
        Manage alerts
      </Button>

      {manageOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-heading text-lg font-semibold">Patient alerts</h2>
              <button
                type="button"
                onClick={() => {
                  setManageOpen(false);
                  setEditingId(null);
                  setEditingAllergyId(null);
                  setAdding(false);
                  setAddingAllergy(false);
                }}
                className="rounded-md p-2 hover:bg-accent min-h-11 min-w-11 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {sorted.length === 0 && allergies.length === 0 && !adding && !addingAllergy && (
                <p className="text-sm text-muted-foreground">
                  No active alerts or allergies.
                </p>
              )}

              <ul className="space-y-2">
                {allergies.map((allergy) =>
                  editingAllergyId === allergy.id ? (
                    <li key={allergy.id} className="space-y-2 rounded-md border p-3">
                      <AllergyFormFields
                        form={allergyForm}
                        setForm={setAllergyForm}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-11"
                          onClick={() =>
                            updateAllergy.mutate({
                              id: allergy.id,
                              allergen: allergyForm.allergen.trim(),
                              reaction: allergyForm.reaction.trim() || undefined,
                              severity: allergyForm.severity,
                              clientUpdatedAt: editSnapshot.updatedAt
                                ? new Date(editSnapshot.updatedAt)
                                : undefined,
                            })
                          }
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingAllergyId(null)}
                          className="min-h-11"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={allergy.id}
                      className={cn(
                        "flex justify-between gap-2 rounded-md border p-3 text-sm",
                        allergyBanner[allergy.severity]
                      )}
                    >
                      <div>
                        <p className="font-medium">{allergy.allergen}</p>
                        <p className="text-xs capitalize opacity-80">
                          allergy · {allergy.severity}
                        </p>
                        {allergy.reaction && (
                          <p className="mt-1 text-xs">{allergy.reaction}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          className="rounded p-2 hover:bg-black/5 min-h-11 min-w-11 flex items-center justify-center"
                          onClick={() => {
                            setEditingAllergyId(allergy.id);
                            setEditingId(null);
                            setAddingAllergy(false);
                            setAllergyForm({
                              allergen: allergy.allergen,
                              reaction: allergy.reaction ?? "",
                              severity: allergy.severity,
                            });
                            setEditSnapshot({ updatedAt: allergy.updatedAt });
                          }}
                          aria-label="Edit allergy"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-2 hover:bg-black/5 min-h-11 min-w-11 flex items-center justify-center"
                          onClick={() => {
                            if (confirm("Remove this allergy?")) {
                              deleteAllergy.mutate({ id: allergy.id });
                            }
                          }}
                          aria-label="Delete allergy"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  )
                )}
                {sorted.map((alert) =>
                  editingId === alert.id ? (
                    <li key={alert.id} className="space-y-2 rounded-md border p-3">
                      <AlertFormFields form={form} setForm={setForm} />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="min-h-11"
                          onClick={() =>
                            update.mutate({
                              id: alert.id,
                              type: form.type,
                              severity: form.severity,
                              title: form.title.trim(),
                              notes: form.notes.trim() || undefined,
                              expiresAt: form.expiresAt
                                ? new Date(form.expiresAt)
                                : null,
                              clientUpdatedAt: editSnapshot.updatedAt
                                ? new Date(editSnapshot.updatedAt)
                                : undefined,
                            })
                          }
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                          className="min-h-11"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ) : (
                    <li
                      key={alert.id}
                      className={cn(
                        "flex justify-between gap-2 rounded-md border p-3 text-sm",
                        severityBanner[alert.severity]
                      )}
                    >
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-xs capitalize opacity-80">
                          {alert.type} · {alert.severity}
                        </p>
                        {alert.notes && (
                          <p className="mt-1 text-xs">{alert.notes}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          className="rounded p-2 hover:bg-black/5 min-h-11 min-w-11 flex items-center justify-center"
                          onClick={() => {
                            setEditingId(alert.id);
                            setEditingAllergyId(null);
                            setForm({
                              type: alert.type,
                              severity: alert.severity,
                              title: alert.title,
                              notes: alert.notes ?? "",
                              expiresAt: alert.expiresAt
                                ? new Date(alert.expiresAt).toISOString().slice(0, 10)
                                : "",
                            });
                            setEditSnapshot({ updatedAt: alert.updatedAt });
                          }}
                          aria-label="Edit alert"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-2 hover:bg-black/5 min-h-11 min-w-11 flex items-center justify-center"
                          onClick={() => {
                            if (confirm("Remove this alert?")) {
                              remove.mutate({ id: alert.id });
                            }
                          }}
                          aria-label="Delete alert"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  )
                )}
              </ul>

              {adding ? (
                <form
                  className="space-y-3 border-t border-border pt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    create.mutate({
                      patientId,
                      type: form.type,
                      severity: form.severity,
                      title: form.title.trim(),
                      notes: form.notes.trim() || undefined,
                      expiresAt: form.expiresAt
                        ? new Date(form.expiresAt)
                        : undefined,
                    });
                  }}
                >
                  <AlertFormFields form={form} setForm={setForm} />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={create.isPending} className="min-h-11">
                      Save alert
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAdding(false)}
                      className="min-h-11"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 w-full"
                  onClick={() => {
                    setAdding(true);
                    setAddingAllergy(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add alert
                </Button>
              )}

              {addingAllergy ? (
                <form
                  className="space-y-3 border-t border-border pt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addAllergy.mutate({
                      patientId,
                      allergen: allergyForm.allergen.trim(),
                      reaction: allergyForm.reaction.trim() || undefined,
                      severity: allergyForm.severity,
                    });
                  }}
                >
                  <AllergyFormFields
                    form={allergyForm}
                    setForm={setAllergyForm}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={addAllergy.isPending}
                      className="min-h-11"
                    >
                      Save allergy
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAddingAllergy(false)}
                      className="min-h-11"
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 w-full"
                  onClick={() => {
                    setAddingAllergy(true);
                    setAdding(false);
                    setEditingAllergyId(null);
                    setAllergyForm({
                      allergen: "",
                      reaction: "",
                      severity: "moderate",
                    });
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add allergy
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PatientAlertsBanner({ patientId }: { patientId: string }) {
  const { data: alerts = [] } = trpc.patientAlerts.list.useQuery({
    patientId,
    activeOnly: true,
  });

  const sorted = [...alerts].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
  const topAlerts = sorted.slice(0, 3);

  if (topAlerts.length === 0) return null;

  return (
    <div className="mt-4 flex flex-1 flex-col gap-2">
      {topAlerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex items-start gap-2 rounded-lg border p-3 text-sm",
            severityBanner[alert.severity]
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">
              {alert.title}
              <span className="ml-2 text-xs font-normal opacity-80 capitalize">
                ({alert.type})
              </span>
            </p>
            {alert.notes && (
              <p className="mt-0.5 text-xs opacity-90">{alert.notes}</p>
            )}
          </div>
        </div>
      ))}
      {sorted.length > 3 && (
        <p className="text-xs text-muted-foreground">
          +{sorted.length - 3} more alert{sorted.length - 3 !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function AllergyFormFields({
  form,
  setForm,
}: {
  form: {
    allergen: string;
    reaction: string;
    severity: AllergySeverity;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
}) {
  return (
    <>
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
            severity: e.target.value as AllergySeverity,
          }))
        }
        className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="mild">Mild</option>
        <option value="moderate">Moderate</option>
        <option value="severe">Severe</option>
      </select>
    </>
  );
}

function AlertFormFields({
  form,
  setForm,
}: {
  form: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    notes: string;
    expiresAt: string;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Type</label>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({ ...f, type: e.target.value as AlertType }))
            }
            className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {visibleAlertTypes.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Severity</label>
          <select
            value={form.severity}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                severity: e.target.value as AlertSeverity,
              }))
            }
            className="w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>
      <Input
        placeholder="Title (e.g. Fearful with strangers)"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        required
        className="min-h-11"
      />
      <textarea
        placeholder="Notes (optional)"
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div>
        <label className="mb-1 block text-xs font-medium">Expires (optional)</label>
        <Input
          type="date"
          value={form.expiresAt}
          onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
          className="min-h-11"
        />
      </div>
    </>
  );
}
