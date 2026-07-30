/** Helpers for portal → staff appointment request communications. */

export const APPT_REQUEST_SUBJECT_PREFIX = "Appointment request for";
export const APPT_REQUEST_CALLBACK_PREFIX = "Callback:";

export type ParsedAppointmentRequest = {
  patientName: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  reason: string | null;
};

export function buildAppointmentRequestSubject(patientName: string): string {
  return `${APPT_REQUEST_SUBJECT_PREFIX} ${patientName}`;
}

export function buildAppointmentRequestContent(input: {
  patientName: string;
  preferredDate: string;
  preferredTime: string;
  reason: string;
}): string {
  return [
    "Request-Type: appointment",
    `Pet: ${input.patientName}`,
    `Preferred date: ${input.preferredDate}`,
    `Preferred time: ${input.preferredTime}`,
    `Reason: ${input.reason}`,
  ].join("\n");
}

export function isOpenAppointmentRequestSubject(
  subject: string | null | undefined
): boolean {
  if (!subject) return false;
  const s = subject.trim();
  if (s.startsWith(APPT_REQUEST_CALLBACK_PREFIX)) {
    const rest = s.slice(APPT_REQUEST_CALLBACK_PREFIX.length).trim();
    return rest.startsWith(APPT_REQUEST_SUBJECT_PREFIX);
  }
  return s.startsWith(APPT_REQUEST_SUBJECT_PREFIX);
}

export function isCallbackAppointmentRequestSubject(
  subject: string | null | undefined
): boolean {
  if (!subject) return false;
  return subject.trim().startsWith(APPT_REQUEST_CALLBACK_PREFIX);
}

export function parseAppointmentRequestContent(
  content: string | null | undefined
): ParsedAppointmentRequest {
  const lines = (content ?? "").split("\n");
  const get = (label: string) => {
    const line = lines.find((l) =>
      l.toLowerCase().startsWith(label.toLowerCase())
    );
    if (!line) return null;
    const idx = line.indexOf(":");
    return idx >= 0 ? line.slice(idx + 1).trim() || null : null;
  };
  return {
    patientName: get("Pet"),
    preferredDate: get("Preferred date"),
    preferredTime: get("Preferred time"),
    reason: get("Reason"),
  };
}

/** Map vague portal preferences to a default HH:mm start. */
export function preferredTimeToDefaultStart(
  preferredTime: string | null | undefined
): string {
  const t = (preferredTime ?? "").toLowerCase();
  if (t.includes("afternoon")) return "14:00";
  if (t.includes("evening")) return "16:00";
  if (t.includes("morning")) return "09:00";
  // Try to parse something like "10:30" or "10:30 AM"
  const match = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (match) {
    let h = parseInt(match[1]!, 10);
    const m = match[2]!;
    const ampm = match[3]?.toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  return "09:00";
}

export function toCallbackSubject(subject: string | null | undefined): string {
  const base = (subject ?? APPT_REQUEST_SUBJECT_PREFIX).trim();
  if (base.startsWith(APPT_REQUEST_CALLBACK_PREFIX)) return base;
  return `${APPT_REQUEST_CALLBACK_PREFIX} ${base}`;
}
