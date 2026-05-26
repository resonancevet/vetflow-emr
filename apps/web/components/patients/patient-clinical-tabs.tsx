"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  FlaskConical,
  Pencil,
  Pill,
  Plus,
  Scissors,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { generatePrescriptionLabelPdf } from "@/lib/pdf";

/**
 * Patient-scoped clinical tab bodies.
 *
 * These were previously housed on the Records page; consolidating them onto
 * the patient detail page is part of the v0 nav simplification (one fewer
 * destination, one less concept).
 */

type SelectedPatient = {
  id: string;
  name: string;
  species: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
};

function getPrescriptionStatusBadge(status: string | null) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "completed":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    case "discontinued":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

function getLabStatusBadge(status: string | null) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    case "completed":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "reviewed":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
}

function isOutOfRange(
  resultValue: string | null,
  low: string | null,
  high: string | null
): boolean {
  if (!resultValue) return false;
  const val = parseFloat(resultValue);
  if (isNaN(val)) return false;
  if (low !== null && low !== undefined) {
    const lowVal = parseFloat(low);
    if (!isNaN(lowVal) && val < lowVal) return true;
  }
  if (high !== null && high !== undefined) {
    const highVal = parseFloat(high);
    if (!isNaN(highVal) && val > highVal) return true;
  }
  return false;
}

export function SoapNotesTab({
  patient,
  canCreate,
}: {
  patient: SelectedPatient;
  canCreate: boolean;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: soapNotes } = trpc.records.listSoapNotes.useQuery({
    patientId: patient.id,
  });
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  });

  const updateNote = trpc.records.updateSoapNote.useMutation({
    onSuccess: () => {
      toast.success("SOAP note updated");
      utils.records.listSoapNotes.invalidate({ patientId: patient.id });
      setEditingNoteId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const startEdit = (note: {
    id: string;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
  }) => {
    setEditingNoteId(note.id);
    setExpandedNoteId(note.id);
    setEditForm({
      subjective: note.subjective ?? "",
      objective: note.objective ?? "",
      assessment: note.assessment ?? "",
      plan: note.plan ?? "",
    });
  };

  const cancelEdit = () => setEditingNoteId(null);

  const saveEdit = () => {
    if (!editingNoteId) return;
    updateNote.mutate({
      id: editingNoteId,
      subjective: editForm.subjective,
      objective: editForm.objective,
      assessment: editForm.assessment,
      plan: editForm.plan,
    });
  };

  return (
    <div>
      {canCreate && (
        <div className="mb-4 flex justify-end">
          <Button
            size="sm"
            onClick={() => router.push(`/records/new-soap/${patient.id}`)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New SOAP Note
          </Button>
        </div>
      )}

      {soapNotes && soapNotes.length > 0 ? (
        <div className="space-y-3">
          {soapNotes.map((note) => {
            const isExpanded = expandedNoteId === note.id;
            const isEditing = editingNoteId === note.id;
            return (
              <div
                key={note.id}
                className="rounded-lg border border-border bg-card"
              >
                <button
                  type="button"
                  onClick={() => {
                    // Don't collapse while editing — clicking the header should
                    // stay benign if the user is mid-edit.
                    if (isEditing) return;
                    setExpandedNoteId(isExpanded ? null : note.id);
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {note.createdAt
                          ? new Date(note.createdAt).toLocaleDateString()
                          : "No date"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {note.authorName ?? "Unknown author"}
                      </p>
                    </div>
                    <p className="line-clamp-1 max-w-md text-sm text-muted-foreground">
                      {note.assessment || "No assessment recorded"}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isExpanded && (
                  <div className="space-y-4 border-t border-border px-4 py-4">
                    {isEditing ? (
                      <>
                        <SoapEditField
                          label="Subjective"
                          value={editForm.subjective}
                          onChange={(v) =>
                            setEditForm((f) => ({ ...f, subjective: v }))
                          }
                        />
                        <SoapEditField
                          label="Objective"
                          value={editForm.objective}
                          onChange={(v) =>
                            setEditForm((f) => ({ ...f, objective: v }))
                          }
                        />
                        <SoapEditField
                          label="Assessment"
                          value={editForm.assessment}
                          onChange={(v) =>
                            setEditForm((f) => ({ ...f, assessment: v }))
                          }
                        />
                        <SoapEditField
                          label="Plan"
                          value={editForm.plan}
                          onChange={(v) =>
                            setEditForm((f) => ({ ...f, plan: v }))
                          }
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                            disabled={updateNote.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={saveEdit}
                            disabled={updateNote.isPending}
                          >
                            {updateNote.isPending ? "Saving..." : "Save changes"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {canCreate && (
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(note)}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                          </div>
                        )}
                        <SoapField label="Subjective" value={note.subjective} />
                        <SoapField label="Objective" value={note.objective} />
                        <SoapField label="Assessment" value={note.assessment} />
                        <SoapField label="Plan" value={note.plan} />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No SOAP notes yet
          </p>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => router.push(`/records/new-soap/${patient.id}`)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create First Note
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SoapField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </h4>
      <p className="whitespace-pre-wrap text-sm">{value || "--"}</p>
    </div>
  );
}

function SoapEditField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[4rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

export function PrescriptionsTab({
  patient,
  canManage,
}: {
  patient: SelectedPatient;
  canManage: boolean;
}) {
  const utils = trpc.useUtils();
  const { data: prescriptions } = trpc.records.listPrescriptions.useQuery({
    patientId: patient.id,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    medicationName: "",
    dosage: "",
    frequency: "",
    quantity: "",
    refillsRemaining: "0",
    startDate: "",
    endDate: "",
    status: "active" as "active" | "completed" | "cancelled" | "expired",
    instructions: "",
  });

  const invalidate = () =>
    utils.records.listPrescriptions.invalidate({ patientId: patient.id });

  const updatePrescription = trpc.records.updatePrescription.useMutation({
    onSuccess: () => {
      toast.success("Prescription updated");
      setEditingId(null);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deletePrescription = trpc.records.deletePrescription.useMutation({
    onSuccess: () => {
      toast.success("Prescription removed");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const startEditPrescription = (rx: NonNullable<typeof prescriptions>[number]) => {
    setEditingId(rx.id);
    setForm({
      medicationName: rx.medicationName,
      dosage: rx.dosage ?? "",
      frequency: rx.frequency ?? "",
      quantity: rx.quantity != null ? String(rx.quantity) : "",
      refillsRemaining: String(rx.refillsRemaining ?? 0),
      startDate: rx.startDate ?? new Date().toISOString().slice(0, 10),
      endDate: rx.endDate ?? "",
      status: (rx.status ?? "active") as typeof form.status,
      instructions: rx.instructions ?? "",
    });
  };

  const savePrescription = () => {
    if (!editingId) return;
    const quantity = form.quantity ? Number(form.quantity) : undefined;
    updatePrescription.mutate({
      id: editingId,
      medicationName: form.medicationName.trim(),
      dosage: form.dosage.trim(),
      frequency: form.frequency.trim(),
      quantity: Number.isFinite(quantity) ? quantity : undefined,
      refillsRemaining: Number(form.refillsRemaining) || 0,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
      status: form.status,
      instructions: form.instructions || undefined,
    });
  };

  if (!prescriptions || prescriptions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <Pill className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          No prescriptions yet
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Medication
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Dosage
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Frequency
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Refills
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {prescriptions.map((rx) => {
            const isEditing = editingId === rx.id;
            return (
              <tr
                key={rx.id}
                className="border-b border-border align-top last:border-0"
              >
                <td className="px-4 py-3 font-medium">
                  {isEditing ? (
                    <Input
                      value={form.medicationName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, medicationName: e.target.value }))
                      }
                      required
                    />
                  ) : (
                    rx.medicationName
                  )}
                  {isEditing && (
                    <Input
                      className="mt-2"
                      value={form.instructions}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, instructions: e.target.value }))
                      }
                      placeholder="Instructions"
                    />
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <Input
                      value={form.dosage}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, dosage: e.target.value }))
                      }
                      required
                    />
                  ) : (
                    rx.dosage ?? "--"
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <Input
                      value={form.frequency}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, frequency: e.target.value }))
                      }
                      required
                    />
                  ) : (
                    rx.frequency ?? "--"
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          status: e.target.value as typeof form.status,
                        }))
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="expired">Expired</option>
                    </select>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                        getPrescriptionStatusBadge(rx.status)
                      )}
                    >
                      {rx.status ?? "unknown"}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {isEditing ? (
                    <div className="grid min-w-[11rem] gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={form.refillsRemaining}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            refillsRemaining: e.target.value,
                          }))
                        }
                        placeholder="Refills"
                      />
                      <Input
                        type="date"
                        value={form.startDate}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, startDate: e.target.value }))
                        }
                        required
                      />
                    </div>
                  ) : (
                    rx.refillsRemaining ?? 0
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatePrescription.isPending}
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={updatePrescription.isPending}
                          onClick={savePrescription}
                        >
                          {updatePrescription.isPending ? "Saving..." : "Save"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Print Label"
                          onClick={() => {
                            const clientName = [
                              patient.clientFirstName,
                              patient.clientLastName,
                            ]
                              .filter(Boolean)
                              .join(" ");
                            generatePrescriptionLabelPdf({
                              practiceName: "",
                              patientName: patient.name,
                              clientName,
                              species: patient.species ?? "",
                              medicationName: rx.medicationName,
                              dosage: rx.dosage ?? "",
                              frequency: rx.frequency ?? "",
                              instructions: rx.instructions ?? undefined,
                              prescribedBy: rx.prescriberName ?? "",
                              startDate: rx.startDate
                                ? new Date(rx.startDate).toLocaleDateString()
                                : new Date().toLocaleDateString(),
                              quantity:
                                rx.quantity != null ? String(rx.quantity) : undefined,
                              refillsRemaining: rx.refillsRemaining ?? undefined,
                            }).save(
                              `label-${rx.medicationName
                                .replace(/\s+/g, "-")
                                .toLowerCase()}.pdf`
                            );
                          }}
                        >
                          <Tag className="mr-1 h-3.5 w-3.5" />
                          Print Label
                        </Button>
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditPrescription(rx)}
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deletePrescription.isPending}
                              onClick={() => {
                                if (confirm("Remove this prescription?")) {
                                  deletePrescription.mutate({ id: rx.id });
                                }
                              }}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProblemsTab({
  patient,
  canManage,
}: {
  patient: SelectedPatient;
  canManage: boolean;
}) {
  const utils = trpc.useUtils();
  const { data: problems } = trpc.records.listProblems.useQuery({
    patientId: patient.id,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    description: "",
    status: "active" as "active" | "resolved" | "chronic",
    onsetDate: "",
  });

  const invalidate = () =>
    utils.records.listProblems.invalidate({ patientId: patient.id });

  const updateProblem = trpc.records.updateProblem.useMutation({
    onSuccess: () => {
      toast.success("Problem updated");
      setEditingId(null);
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteProblem = trpc.records.deleteProblem.useMutation({
    onSuccess: () => {
      toast.success("Problem removed");
      invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const startEditProblem = (problem: NonNullable<typeof problems>[number]) => {
    setEditingId(problem.id);
    setForm({
      description: problem.description,
      status: (problem.status ?? "active") as typeof form.status,
      onsetDate: problem.onsetDate ?? "",
    });
  };

  const saveProblem = () => {
    if (!editingId) return;
    updateProblem.mutate({
      id: editingId,
      description: form.description.trim(),
      status: form.status,
      onsetDate: form.onsetDate || undefined,
    });
  };

  if (!problems || problems.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">
          No problems recorded
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {problems.map((problem) => {
        const isEditing = editingId === problem.id;
        return (
          <div
            key={problem.id}
            className="rounded-lg border border-border bg-card px-4 py-3"
          >
            {isEditing ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Description
                  </label>
                  <Input
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as typeof form.status,
                      }))
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="chronic">Chronic</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Onset</label>
                  <Input
                    type="date"
                    value={form.onsetDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, onsetDate: e.target.value }))
                    }
                  />
                </div>
                <div className="flex gap-2 sm:col-span-3">
                  <Button
                    size="sm"
                    disabled={updateProblem.isPending}
                    onClick={saveProblem}
                  >
                    {updateProblem.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updateProblem.isPending}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p
                    className={cn(
                      "text-sm",
                      problem.status === "active" ? "font-semibold" : "font-normal"
                    )}
                  >
                    {problem.description}
                  </p>
                  {problem.onsetDate && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Onset: {new Date(problem.onsetDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                      problem.status === "active"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        : problem.status === "chronic"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                    )}
                  >
                    {problem.status ?? "active"}
                  </span>
                  {canManage && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditProblem(problem)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deleteProblem.isPending}
                        onClick={() => {
                          if (confirm("Remove this problem?")) {
                            deleteProblem.mutate({ id: problem.id });
                          }
                        }}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function LabResultsTab({ patient }: { patient: SelectedPatient }) {
  const [showLabForm, setShowLabForm] = useState(false);
  const { data: labResultsList, refetch } = trpc.records.listLabResults.useQuery({
    patientId: patient.id,
  });

  const createLabResult = trpc.records.createLabResult.useMutation({
    onSuccess: () => {
      toast.success("Lab result created");
      refetch();
      setShowLabForm(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateLabResultStatus =
    trpc.records.updateLabResultStatus.useMutation({
      onSuccess: () => {
        toast.success("Lab result status updated");
        refetch();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setShowLabForm((v) => !v)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {showLabForm ? "Cancel" : "Add Lab Result"}
        </Button>
      </div>

      {showLabForm && (
        <form
          className="mb-6 space-y-4 rounded-lg border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            createLabResult.mutate({
              patientId: patient.id,
              testName: formData.get("testName") as string,
              resultValue:
                (formData.get("resultValue") as string) || undefined,
              unit: (formData.get("unit") as string) || undefined,
              referenceRangeLow:
                (formData.get("referenceRangeLow") as string) || undefined,
              referenceRangeHigh:
                (formData.get("referenceRangeHigh") as string) || undefined,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Test Name *
              </label>
              <Input name="testName" required placeholder="e.g. CBC" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Result Value
              </label>
              <Input name="resultValue" placeholder="e.g. 12.5" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Unit
              </label>
              <Input name="unit" placeholder="e.g. mg/dL" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Ref. Range Low
              </label>
              <Input name="referenceRangeLow" placeholder="e.g. 7.0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Ref. Range High
              </label>
              <Input name="referenceRangeHigh" placeholder="e.g. 27.0" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createLabResult.isPending}>
              {createLabResult.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      )}

      {labResultsList && labResultsList.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[840px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Test
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Result
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Unit
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Reference
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Ordered By
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {labResultsList.map((lab) => {
                const outOfRange = isOutOfRange(
                  lab.resultValue,
                  lab.referenceRangeLow,
                  lab.referenceRangeHigh
                );
                return (
                  <tr
                    key={lab.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium">{lab.testName}</td>
                    <td
                      className={cn(
                        "px-4 py-3",
                        outOfRange
                          ? "font-semibold text-red-600 dark:text-red-400"
                          : ""
                      )}
                    >
                      {lab.resultValue ?? "--"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lab.unit ?? "--"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lab.referenceRangeLow != null &&
                      lab.referenceRangeHigh != null
                        ? `${lab.referenceRangeLow} - ${lab.referenceRangeHigh}`
                        : "--"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                          getLabStatusBadge(lab.status)
                        )}
                      >
                        {lab.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lab.orderedByName ?? "--"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lab.createdAt
                        ? new Date(lab.createdAt).toLocaleDateString()
                        : "--"}
                    </td>
                    <td className="px-4 py-3">
                      {lab.status === "completed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updateLabResultStatus.isPending}
                          onClick={() =>
                            updateLabResultStatus.mutate({
                              id: lab.id,
                              status: "reviewed",
                            })
                          }
                        >
                          Mark Reviewed
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <FlaskConical className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No lab results yet
          </p>
        </div>
      )}
    </div>
  );
}

export function ProceduresTab({ patient }: { patient: SelectedPatient }) {
  const [showProcedureForm, setShowProcedureForm] = useState(false);
  const { data: proceduresList, refetch } = trpc.records.listProcedures.useQuery({
    patientId: patient.id,
  });

  const createProcedure = trpc.records.createProcedure.useMutation({
    onSuccess: () => {
      toast.success("Procedure recorded");
      refetch();
      setShowProcedureForm(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setShowProcedureForm((v) => !v)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {showProcedureForm ? "Cancel" : "Add Procedure"}
        </Button>
      </div>

      {showProcedureForm && (
        <form
          className="mb-6 space-y-4 rounded-lg border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formData = new FormData(form);
            const durationStr = formData.get("durationMinutes") as string;
            createProcedure.mutate({
              patientId: patient.id,
              name: formData.get("name") as string,
              description:
                (formData.get("description") as string) || undefined,
              anesthesiaUsed:
                (formData.get("anesthesiaUsed") as string) || undefined,
              durationMinutes: durationStr
                ? parseInt(durationStr, 10)
                : undefined,
              notes: (formData.get("notes") as string) || undefined,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Name *
              </label>
              <Input
                name="name"
                required
                placeholder="e.g. Dental Prophylaxis"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Duration (minutes)
              </label>
              <Input
                name="durationMinutes"
                type="number"
                placeholder="e.g. 45"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Input
                name="description"
                placeholder="Brief description of the procedure"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Anesthesia Used
              </label>
              <Input name="anesthesiaUsed" placeholder="e.g. Isoflurane" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Notes
              </label>
              <Input name="notes" placeholder="Additional notes" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createProcedure.isPending}>
              {createProcedure.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      )}

      {proceduresList && proceduresList.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Performed By
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Duration
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Anesthesia
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {proceduresList.map((proc) => (
                <tr
                  key={proc.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{proc.name}</p>
                    {proc.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {proc.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {proc.performedByName ?? "--"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {proc.durationMinutes
                      ? `${proc.durationMinutes} min`
                      : "--"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {proc.anesthesiaUsed ?? "--"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {proc.createdAt
                      ? new Date(proc.createdAt).toLocaleDateString()
                      : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Scissors className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No procedures recorded
          </p>
        </div>
      )}
    </div>
  );
}
