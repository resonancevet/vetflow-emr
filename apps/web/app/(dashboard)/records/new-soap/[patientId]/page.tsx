"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Save, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export default function NewSoapNotePage() {
  const params = useParams<{ patientId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  if (userRole && userRole !== "admin" && userRole !== "veterinarian") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="font-heading text-xl font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Only veterinarians and administrators can create SOAP notes.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/records")}
        >
          Back to Records
        </Button>
      </div>
    );
  }

  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");

  const { data: patient, isLoading: patientLoading } =
    trpc.patients.getById.useQuery(
      { id: params.patientId },
      { enabled: !!params.patientId }
    );

  const createNote = trpc.records.createSoapNote.useMutation({
    onSuccess: () => {
      router.push("/records");
    },
  });

  function handleSave() {
    if (!params.patientId) return;
    createNote.mutate({
      patientId: params.patientId,
      subjective: subjective || undefined,
      objective: objective || undefined,
      assessment: assessment || undefined,
      plan: plan || undefined,
    });
  }

  if (patientLoading) {
    return (
      <div className="text-center text-muted-foreground py-12">Loading...</div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/records")}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Records
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">New SOAP Note</h2>
          {patient && (
            <p className="text-sm text-muted-foreground">
              Patient: {patient.name}
              {patient.species
                ? ` - ${patient.species.charAt(0).toUpperCase() + patient.species.slice(1)}`
                : ""}
              {patient.breed ? ` (${patient.breed})` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-6">
          {/* Subjective */}
          <div>
            <label
              htmlFor="subjective"
              className="block text-sm font-medium mb-1.5"
            >
              Subjective
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Owner&apos;s complaint, history, and symptoms reported
            </p>
            <textarea
              id="subjective"
              rows={4}
              value={subjective}
              onChange={(e) => setSubjective(e.target.value)}
              placeholder="What the owner reports..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
            />
          </div>

          {/* Objective */}
          <div>
            <label
              htmlFor="objective"
              className="block text-sm font-medium mb-1.5"
            >
              Objective
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Physical examination findings, vitals, and test results
            </p>
            <textarea
              id="objective"
              rows={4}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Physical exam findings, vitals, lab results..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
            />
          </div>

          {/* Assessment */}
          <div>
            <label
              htmlFor="assessment"
              className="block text-sm font-medium mb-1.5"
            >
              Assessment
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Diagnosis or differential diagnoses
            </p>
            <textarea
              id="assessment"
              rows={4}
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              placeholder="Diagnosis, differential diagnoses..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
            />
          </div>

          {/* Plan */}
          <div>
            <label htmlFor="plan" className="block text-sm font-medium mb-1.5">
              Plan
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Treatment plan, medications, follow-up instructions
            </p>
            <textarea
              id="plan"
              rows={4}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="Treatment plan, medications, follow-up..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-y"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={createNote.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {createNote.isPending ? "Saving..." : "Save Note"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/records")}>
            Cancel
          </Button>
          {createNote.isError && (
            <p className="text-sm text-destructive">
              Failed to save: {createNote.error.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
