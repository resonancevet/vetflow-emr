"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { preferredTimeToDefaultStart } from "@/lib/appointment-request";
import { formatPhoneDisplay } from "@/lib/phone-format";

type RequestRow = {
  id: string;
  patientId: string | null;
  clientId?: string | null;
  clientName: string;
  clientPhone?: string | null;
  patientName: string | null;
  patientSpecies?: string | null;
  patientBreed?: string | null;
  patientSex?: string | null;
  patientDob?: string | Date | null;
  preferredDate: string | null;
  preferredTime: string | null;
  reason: string | null;
  clientEmail: string | null;
  needsCallback?: boolean;
};

const SEX_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  male_neutered: "Neutered male",
  female_spayed: "Spayed female",
};

function formatSignalment(input: {
  species?: string | null;
  breed?: string | null;
  sex?: string | null;
  dob?: string | Date | null;
}): string {
  const parts: string[] = [];
  if (input.species) {
    parts.push(
      input.species.charAt(0).toUpperCase() + input.species.slice(1)
    );
  }
  if (input.breed) parts.push(input.breed);
  if (input.sex && SEX_LABELS[input.sex]) parts.push(SEX_LABELS[input.sex]);
  else if (input.sex) parts.push(input.sex.replace(/_/g, " "));
  if (input.dob) {
    const dob = new Date(input.dob);
    if (!Number.isNaN(dob.getTime())) {
      const now = new Date();
      let years = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) years -= 1;
      if (years < 1) {
        const months =
          (now.getFullYear() - dob.getFullYear()) * 12 +
          (now.getMonth() - dob.getMonth());
        parts.push(`${Math.max(months, 0)} mo`);
      } else {
        parts.push(`${years} yr${years === 1 ? "" : "s"}`);
      }
    }
  }
  return parts.join(" · ") || "Signalment not on file";
}

function buildTimeSlots() {
  const slots: { label: string; value: string }[] = [];
  for (let hour = 7; hour <= 19; hour++) {
    for (const min of [0, 15, 30, 45]) {
      if (hour === 19 && min > 0) break;
      const value = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      const d = new Date();
      d.setHours(hour, min, 0, 0);
      slots.push({
        label: d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        value,
      });
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

function toLocalIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const start = new Date(`${date}T${time}:00`);
  if (Number.isNaN(start.getTime())) return null;
  return start.toISOString();
}

export function ApproveAppointmentRequestModal({
  request,
  onClose,
}: {
  request: RequestRow | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: appointmentTypes } = trpc.appointments.listTypes.useQuery(
    undefined,
    { enabled: !!request }
  );
  const { data: doctors } = trpc.appointments.listDoctors.useQuery(undefined, {
    enabled: !!request,
  });
  const { data: roomsList } = trpc.appointments.listRooms.useQuery(undefined, {
    enabled: !!request,
  });

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState(30);
  const [typeId, setTypeId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    const preferred =
      request.preferredDate && /^\d{4}-\d{2}-\d{2}$/.test(request.preferredDate)
        ? request.preferredDate
        : new Date().toISOString().slice(0, 10);
    setDate(preferred);
    setStartTime(preferredTimeToDefaultStart(request.preferredTime));
    setDuration(30);
    setTypeId("");
    setDoctorId("");
    setRoomId("");
    setNotes(request.reason ? `Portal: ${request.reason}` : "");
    setFormError(null);
  }, [request]);

  useEffect(() => {
    if (!request || doctorId) return;
    if (doctors && doctors.length === 1) {
      setDoctorId(doctors[0]!.id);
    }
  }, [doctors, doctorId, request]);

  useEffect(() => {
    if (!typeId || !appointmentTypes) return;
    const found = appointmentTypes.find((t) => t.id === typeId);
    if (found?.durationMinutes) setDuration(found.durationMinutes);
  }, [typeId, appointmentTypes]);

  const startIso = useMemo(() => toLocalIso(date, startTime), [date, startTime]);
  const endIso = useMemo(() => {
    if (!startIso) return null;
    const start = new Date(startIso);
    const end = new Date(start.getTime() + duration * 60_000);
    return end.toISOString();
  }, [startIso, duration]);

  const approve = trpc.dashboard.approveAppointmentRequest.useMutation({
    onSuccess: (data) => {
      setFormError(null);
      void utils.dashboard.listAppointmentRequests.invalidate();
      void utils.dashboard.getStats.invalidate();
      void utils.appointments.list.invalidate();
      onClose();
      if (data.emailSent) {
        toast.success("Appointment scheduled and confirmation emailed");
      } else if (data.emailSkipped) {
        toast.success(
          "Appointment scheduled (no client email on file — confirmation not sent)"
        );
      } else {
        toast.success("Appointment scheduled");
        toast.error(
          data.emailError
            ? `Confirmation email failed: ${data.emailError}`
            : "Confirmation email failed"
        );
      }
    },
    onError: (err) => {
      setFormError(err.message || "Could not schedule appointment");
      toast.error(err.message);
    },
  });

  if (!request) return null;

  const canSubmit = Boolean(startIso && endIso) && !approve.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Approve appointment request
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {request.patientName ?? "Pet"} · {request.clientName}
              {request.preferredDate || request.preferredTime
                ? ` · preferred ${[request.preferredDate, request.preferredTime].filter(Boolean).join(" ")}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Date</span>
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setFormError(null);
                }}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Start time</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setFormError(null);
                }}
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Appointment type</span>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              <option value="">Select type</option>
              {(appointmentTypes ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.durationMinutes} min)
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Duration (minutes)</span>
            <Input
              type="number"
              min={5}
              max={480}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 30)}
            />
          </label>

          {(doctors?.length ?? 0) > 1 && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Doctor</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {(doctors ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(roomsList?.length ?? 0) > 0 && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Room</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              >
                <option value="">None</option>
                {(roomsList ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Notes</span>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {!request.clientEmail && (
            <p className="text-xs text-amber-700">
              This client has no email on file. The appointment will still be
              scheduled, but no confirmation email will be sent.
            </p>
          )}

          {formError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!startIso || !endIso) {
                setFormError("Choose a valid date and start time");
                return;
              }
              setFormError(null);
              approve.mutate({
                requestId: request.id,
                startTime: startIso,
                endTime: endIso,
                ...(typeId ? { typeId } : {}),
                ...(doctorId ? { doctorId } : {}),
                ...(roomId ? { roomId } : {}),
                ...(notes.trim() ? { notes: notes.trim() } : {}),
              });
            }}
          >
            {approve.isPending ? "Scheduling…" : "Schedule & confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DeclineAppointmentRequestModal({
  request,
  onClose,
}: {
  request: RequestRow | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [message, setMessage] = useState(
    "We're sorry — that preferred time isn't available. Please reply with another day or time that works, or give us a call."
  );
  const [sendEmail, setSendEmail] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (request) {
      setSendEmail(Boolean(request.clientEmail));
      setFormError(null);
    }
  }, [request]);

  const decline = trpc.dashboard.declineAppointmentRequest.useMutation({
    onSuccess: (data) => {
      setFormError(null);
      void utils.dashboard.listAppointmentRequests.invalidate();
      void utils.dashboard.getStats.invalidate();
      onClose();
      toast.success(
        data.emailSent
          ? "Request declined and client emailed"
          : "Request declined"
      );
    },
    onError: (err) => {
      setFormError(err.message || "Could not decline request");
      toast.error(err.message);
    },
  });

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Decline appointment request
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {request.patientName ?? "Pet"} · {request.clientName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Message to client</span>
            <textarea
              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendEmail}
              disabled={!request.clientEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Email the client
            {!request.clientEmail && (
              <span className="text-muted-foreground">(no email on file)</span>
            )}
          </label>
          {formError && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={decline.isPending || !message.trim()}
            onClick={() => {
              setFormError(null);
              decline.mutate({
                requestId: request.id,
                message: message.trim(),
                sendEmail,
              });
            }}
          >
            {decline.isPending ? "Declining…" : "Decline request"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CallbackAppointmentRequestPanel({
  request,
  onClose,
}: {
  request: RequestRow | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [note, setNote] = useState("");
  const [removeFromList, setRemoveFromList] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    const pref = [request.preferredDate, request.preferredTime]
      .filter(Boolean)
      .join(" · ");
    const starter = [
      request.reason ? `Portal request: ${request.reason}` : null,
      pref ? `Preferred: ${pref}` : null,
      "Called client regarding appointment request.",
    ]
      .filter(Boolean)
      .join("\n");
    setNote(starter);
    setRemoveFromList(false);
    setFormError(null);
  }, [request]);

  const markCallback = trpc.dashboard.markAppointmentRequestCallback.useMutation(
    {
      onSuccess: (data) => {
        setFormError(null);
        void utils.dashboard.listAppointmentRequests.invalidate();
        void utils.dashboard.getStats.invalidate();
        void utils.communications.list.invalidate();
        onClose();
        toast.success(
          data.removedFromList
            ? "Call logged and request removed from the list"
            : "Call logged — request kept on the dashboard"
        );
      },
      onError: (err) => {
        setFormError(err.message || "Could not save callback");
        toast.error(err.message);
      },
    }
  );

  if (!request) return null;

  const phoneDisplay = request.clientPhone
    ? formatPhoneDisplay(request.clientPhone)
    : null;
  const signalment = formatSignalment({
    species: request.patientSpecies,
    breed: request.patientBreed,
    sex: request.patientSex,
    dob: request.patientDob,
  });

  const scheduleHref = request.preferredDate
    ? `/schedule?date=${encodeURIComponent(request.preferredDate)}`
    : "/schedule";

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label="Call client back"
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col border-t border-border bg-card shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[24rem] md:border-l md:border-t-0"
    >
      <div className="flex items-start justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Call client back
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stays open while you check the schedule.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-3 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Client
            </p>
            <p className="font-medium text-foreground">
              {request.clientName || "Unknown client"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Phone
            </p>
            {phoneDisplay && request.clientPhone ? (
              <a
                href={`tel:${request.clientPhone.replace(/\D/g, "")}`}
                className="font-medium text-primary hover:underline"
              >
                {phoneDisplay}
              </a>
            ) : (
              <p className="text-muted-foreground">No phone on file</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Pet
            </p>
            <p className="font-medium text-foreground">
              {request.patientName ?? "Unknown pet"}
            </p>
            <p className="text-muted-foreground">{signalment}</p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full min-h-11"
          onClick={() => router.push(scheduleHref)}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Open schedule
          {request.preferredDate ? ` (${request.preferredDate})` : ""}
        </Button>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Communication log</span>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setFormError(null);
            }}
            placeholder="What did you discuss? Leave a voicemail? Outcome?"
          />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={removeFromList}
            onChange={(e) => setRemoveFromList(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          <span>
            <span className="font-medium">Remove from appointment requests</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Leave unchecked to keep this request on the dashboard after saving
              the call log.
            </span>
          </span>
        </label>

        {formError && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-border px-4 py-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
          Close
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={markCallback.isPending || !note.trim()}
          onClick={() => {
            if (!note.trim()) {
              setFormError("Add a note for the communication log");
              return;
            }
            setFormError(null);
            markCallback.mutate({
              requestId: request.id,
              note: note.trim(),
              removeFromList,
            });
          }}
        >
          {markCallback.isPending ? "Saving…" : "Save callback log"}
        </Button>
      </div>
    </aside>
  );
}
