"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormKind = "vaccination" | "prescription" | "problem" | null;

export function PatientClinicalAdd({ patientId }: { patientId: string }) {
  const [openForm, setOpenForm] = useState<FormKind>(null);
  const utils = trpc.useUtils();

  const invalidate = () => {
    utils.records.listVaccinations.invalidate({ patientId });
    utils.records.listPrescriptions.invalidate({ patientId });
    utils.records.listProblems.invalidate({ patientId });
    utils.patients.getById.invalidate({ id: patientId });
  };

  const createVaccination = trpc.records.createVaccination.useMutation({
    onSuccess: () => {
      toast.success("Vaccination recorded");
      setOpenForm(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createPrescription = trpc.records.createPrescription.useMutation({
    onSuccess: () => {
      toast.success("Prescription added");
      setOpenForm(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createProblem = trpc.records.createProblem.useMutation({
    onSuccess: () => {
      toast.success("Problem added");
      setOpenForm(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Add clinical record</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={openForm === "vaccination" ? "default" : "outline"}
            onClick={() =>
              setOpenForm(openForm === "vaccination" ? null : "vaccination")
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Vaccine
          </Button>
          <Button
            type="button"
            size="sm"
            variant={openForm === "prescription" ? "default" : "outline"}
            onClick={() =>
              setOpenForm(openForm === "prescription" ? null : "prescription")
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Medication
          </Button>
          <Button
            type="button"
            size="sm"
            variant={openForm === "problem" ? "default" : "outline"}
            onClick={() => setOpenForm(openForm === "problem" ? null : "problem")}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Problem
          </Button>
        </div>
      </div>

      {openForm === "vaccination" && (
        <VaccinationForm
          onSubmit={(data) => createVaccination.mutate({ patientId, ...data })}
          loading={createVaccination.isPending}
        />
      )}
      {openForm === "prescription" && (
        <PrescriptionForm
          onSubmit={(data) => createPrescription.mutate({ patientId, ...data })}
          loading={createPrescription.isPending}
        />
      )}
      {openForm === "problem" && (
        <ProblemForm
          onSubmit={(data) => createProblem.mutate({ patientId, ...data })}
          loading={createProblem.isPending}
        />
      )}
    </div>
  );
}

function VaccinationForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: {
    vaccineName: string;
    lotNumber?: string;
    nextDueDate?: string;
  }) => void;
  loading: boolean;
}) {
  const [vaccineName, setVaccineName] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!vaccineName.trim()) return;
        onSubmit({
          vaccineName: vaccineName.trim(),
          lotNumber: lotNumber || undefined,
          nextDueDate: nextDueDate || undefined,
        });
      }}
    >
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Vaccine name</label>
        <Input
          value={vaccineName}
          onChange={(e) => setVaccineName(e.target.value)}
          placeholder="e.g. Rabies"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Lot number</label>
        <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Next due</label>
        <Input
          type="date"
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : "Save vaccination"}
        </Button>
      </div>
    </form>
  );
}

function PrescriptionForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: {
    medicationName: string;
    dosage: string;
    frequency: string;
    startDate: string;
    instructions?: string;
  }) => void;
  loading: boolean;
}) {
  const [medicationName, setMedicationName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [instructions, setInstructions] = useState("");

  return (
    <form
      className="mt-4 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!medicationName.trim() || !dosage.trim() || !frequency.trim())
          return;
        onSubmit({
          medicationName: medicationName.trim(),
          dosage: dosage.trim(),
          frequency: frequency.trim(),
          startDate,
          instructions: instructions || undefined,
        });
      }}
    >
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Medication</label>
        <Input
          value={medicationName}
          onChange={(e) => setMedicationName(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Dosage</label>
        <Input value={dosage} onChange={(e) => setDosage(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Frequency</label>
        <Input
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Start date</label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium">Instructions</label>
        <Input
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving..." : "Save prescription"}
        </Button>
      </div>
    </form>
  );
}

function ProblemForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: { description: string; status?: "active" | "chronic" }) => void;
  loading: boolean;
}) {
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "chronic">("active");

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!description.trim()) return;
        onSubmit({ description: description.trim(), status });
      }}
    >
      <div>
        <label className="mb-1 block text-xs font-medium">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Chronic otitis"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "active" | "chronic")}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="chronic">Chronic</option>
        </select>
      </div>
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Saving..." : "Save problem"}
      </Button>
    </form>
  );
}

function PatientAlerts({
  patientId,
  allergyCount,
}: {
  patientId: string;
  allergyCount: number;
}) {
  const { data: vaccinations } = trpc.records.listVaccinations.useQuery({
    patientId,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdue = (vaccinations ?? []).filter((v) => {
    if (!v.nextDueDate) return false;
    const due = new Date(v.nextDueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  });

  if (allergyCount === 0 && overdue.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      {overdue.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Overdue vaccinations ({overdue.length})
          </p>
          <ul className="mt-1 list-inside list-disc text-amber-800 dark:text-amber-300">
            {overdue.map((v) => (
              <li key={v.id}>
                {v.vaccineName} — due{" "}
                {v.nextDueDate
                  ? new Date(v.nextDueDate).toLocaleDateString()
                  : "unknown"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export { PatientAlerts };
