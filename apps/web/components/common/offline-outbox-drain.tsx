"use client";

import { useEffect, useRef } from "react";
import { drainOfflineOutbox } from "@/lib/offline/mutations";
import type { OfflineOutboxItem } from "@/lib/offline/outbox";
import {
  saveCachedPatientSnapshot,
  type CachedPatientSnapshot,
} from "@/lib/offline/cache";
import { trpc } from "@/lib/trpc";

/**
 * Registers the reconnect hook for the offline outbox.
 * Replayers are added as individual forms become offline-aware.
 */
export function OfflineOutboxDrain() {
  const addWeight = trpc.patients.addWeight.useMutation();
  const createProblem = trpc.records.createProblem.useMutation();
  const createAlert = trpc.patientAlerts.create.useMutation();
  const utils = trpc.useUtils();

  // Hold the latest mutate fn / utils in refs so the effect can register
  // listeners exactly once and never fire a fresh drain on every re-render.
  // Without this, online + focus + each render would all trigger replays in
  // parallel and create duplicate server rows.
  const addWeightRef = useRef(addWeight);
  const createProblemRef = useRef(createProblem);
  const createAlertRef = useRef(createAlert);
  const utilsRef = useRef(utils);
  addWeightRef.current = addWeight;
  createProblemRef.current = createProblem;
  createAlertRef.current = createAlert;
  utilsRef.current = utils;

  useEffect(() => {
    const refreshCachedPatient = async (patientId: string) => {
      const u = utilsRef.current;
      await Promise.all([
        u.patients.getById.invalidate({ id: patientId }),
        u.patients.getOfflineSnapshot.invalidate({ id: patientId }),
        u.records.listProblems.invalidate({ patientId }),
        u.patientAlerts.list.invalidate({ patientId, activeOnly: true }),
      ]);

      try {
        const fresh = await u.patients.getOfflineSnapshot.fetch({
          id: patientId,
        });
        if (fresh) {
          await saveCachedPatientSnapshot({
            patientId,
            patient: fresh.patient as CachedPatientSnapshot["patient"],
            weights: fresh.weights,
            allergies: fresh.allergies,
            problems: fresh.problems,
            vaccinations: fresh.vaccinations,
            prescriptions: fresh.prescriptions,
            soapNotes: fresh.soapNotes,
            labResults: fresh.labResults,
            procedures: fresh.procedures,
            alerts: fresh.alerts,
          });
        }
      } catch (error) {
        // Non-fatal: the next online patient view will refresh the cache.
        console.warn("Could not refresh cached snapshot after sync", error);
      }
    };

    const replayWeight = async (item: OfflineOutboxItem) => {
      const payload = item.payload as {
        patientId?: unknown;
        weightKg?: unknown;
      };

      if (
        typeof payload.patientId !== "string" ||
        typeof payload.weightKg !== "string"
      ) {
        throw new Error("Queued weight entry is malformed.");
      }

      await addWeightRef.current.mutateAsync({
        patientId: payload.patientId,
        weightKg: payload.weightKg,
      });

      await refreshCachedPatient(payload.patientId);
    };

    const replayProblem = async (item: OfflineOutboxItem) => {
      const payload = item.payload as {
        patientId?: unknown;
        description?: unknown;
        status?: unknown;
        onsetDate?: unknown;
      };

      if (
        typeof payload.patientId !== "string" ||
        typeof payload.description !== "string" ||
        !["active", "resolved", "chronic"].includes(String(payload.status))
      ) {
        throw new Error("Queued problem entry is malformed.");
      }

      await createProblemRef.current.mutateAsync({
        patientId: payload.patientId,
        description: payload.description,
        status: payload.status as "active" | "resolved" | "chronic",
        onsetDate:
          typeof payload.onsetDate === "string" ? payload.onsetDate : undefined,
      });

      await refreshCachedPatient(payload.patientId);
    };

    const replayAlert = async (item: OfflineOutboxItem) => {
      const payload = item.payload as {
        patientId?: unknown;
        type?: unknown;
        severity?: unknown;
        title?: unknown;
        notes?: unknown;
      };

      if (
        typeof payload.patientId !== "string" ||
        typeof payload.title !== "string" ||
        !["behavior", "medical", "financial", "other"].includes(
          String(payload.type)
        ) ||
        !["info", "warning", "critical"].includes(String(payload.severity))
      ) {
        throw new Error("Queued alert entry is malformed.");
      }

      await createAlertRef.current.mutateAsync({
        patientId: payload.patientId,
        type: payload.type as "behavior" | "medical" | "financial" | "other",
        severity: payload.severity as "info" | "warning" | "critical",
        title: payload.title,
        notes: typeof payload.notes === "string" ? payload.notes : undefined,
      });

      await refreshCachedPatient(payload.patientId);
    };

    const drain = () => {
      drainOfflineOutbox({
        "patients.addWeight": replayWeight,
        "records.createProblem": replayProblem,
        "patientAlerts.create": replayAlert,
      }).catch((error) => {
        console.warn("Offline outbox drain failed", error);
      });
    };

    window.addEventListener("online", drain);
    window.addEventListener("focus", drain);
    drain();

    return () => {
      window.removeEventListener("online", drain);
      window.removeEventListener("focus", drain);
    };
  }, []);

  return null;
}
