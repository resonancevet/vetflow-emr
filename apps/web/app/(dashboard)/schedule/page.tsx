"use client";

import { useState, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  User,
  Filter,
  X,
  Loader2,
  Plus,
  Mail,
  CloudDownload,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type CachedAppointment,
  type CachedSchedule,
  getCachedSchedule,
  saveCachedPatientSnapshot,
  saveCachedSchedule,
  updateCachedAppointmentStatus,
} from "@/lib/offline/cache";
import { runOrQueueMutation } from "@/lib/offline/mutations";
import { useNetworkStatus } from "@/lib/offline/use-network-status";

// --- Constants ---

const START_HOUR = 8;
const END_HOUR = 18;
const HOUR_HEIGHT_DEFAULT = 60;
const HOUR_HEIGHT_LG = 72;
const TOTAL_HOURS = END_HOUR - START_HOUR;

type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_exam"
  | "checked_out"
  | "no_show"
  | "cancelled";

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-500",
  confirmed: "bg-blue-500",
  checked_in: "bg-amber-500",
  in_exam: "bg-amber-500",
  checked_out: "bg-green-500",
  no_show: "bg-red-500",
  cancelled: "bg-red-500",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  in_exam: "In Exam",
  checked_out: "Checked Out",
  no_show: "No Show",
  cancelled: "Cancelled",
};

// --- Helpers ---

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getTopOffset(time: Date, hourHeight: number): number {
  const hours = time.getHours() + time.getMinutes() / 60;
  return (hours - START_HOUR) * hourHeight;
}

function getBlockHeight(start: Date, end: Date, hourHeight: number): number {
  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.max(diffHours * hourHeight, 28);
}

/**
 * Assign each appointment a column index inside an overlap cluster so
 * overlapping appointments stagger horizontally instead of stacking on top of
 * each other. Appointments that don't overlap reuse columns.
 */
function layoutAppointments(
  list: Appointment[]
): Map<string, { column: number; columnCount: number }> {
  const sorted = [...list].sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const layout = new Map<string, { column: number; columnCount: number }>();

  type Active = { id: string; end: number; column: number };
  let cluster: { ids: string[]; active: Active[]; maxColumns: number } = {
    ids: [],
    active: [],
    maxColumns: 0,
  };

  const flush = () => {
    for (const id of cluster.ids) {
      const existing = layout.get(id)!;
      layout.set(id, {
        column: existing.column,
        columnCount: cluster.maxColumns,
      });
    }
    cluster = { ids: [], active: [], maxColumns: 0 };
  };

  for (const appt of sorted) {
    const startMs = new Date(appt.startTime).getTime();
    const endMs = new Date(appt.endTime).getTime();

    cluster.active = cluster.active.filter((a) => a.end > startMs);
    if (cluster.active.length === 0 && cluster.ids.length > 0) flush();

    const usedColumns = new Set(cluster.active.map((a) => a.column));
    let column = 0;
    while (usedColumns.has(column)) column += 1;

    cluster.active.push({ id: appt.id, end: endMs, column });
    cluster.ids.push(appt.id);
    cluster.maxColumns = Math.max(
      cluster.maxColumns,
      cluster.active.length,
      column + 1
    );
    layout.set(appt.id, { column, columnCount: cluster.maxColumns });
  }

  if (cluster.ids.length > 0) flush();
  return layout;
}

// --- Types for appointment from API ---

type Appointment = {
  id: string;
  startTime: Date | string;
  endTime: Date | string;
  status: string;
  notes: string | null;
  patientName: string | null;
  patientSpecies: string | null;
  patientId: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientId: string | null;
  doctorName: string | null;
  doctorId: string | null;
  typeName: string | null;
  typeColor: string | null;
  typeDuration: number | null;
  roomName: string | null;
  /** True for appointments whose status was changed offline. */
  pendingOffline?: boolean;
};

// --- Components ---

function StatusDot({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status as AppointmentStatus] || "bg-gray-400";
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full shrink-0", colorClass)}
    />
  );
}

function TimeSlots({ hourHeight }: { hourHeight: number }) {
  const slots = [];
  for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
    const label =
      hour === 0
        ? "12 AM"
        : hour < 12
          ? `${hour} AM`
          : hour === 12
            ? "12 PM"
            : `${hour - 12} PM`;
    slots.push(
      <div
        key={hour}
        className="relative"
        style={{ height: hour < END_HOUR ? hourHeight : 0 }}
      >
        <span className="absolute -top-3 right-3 text-xs lg:text-sm text-muted-foreground select-none">
          {label}
        </span>
      </div>
    );
  }
  return <div className="w-16 shrink-0 pt-0">{slots}</div>;
}

function GridLines({ hourHeight }: { hourHeight: number }) {
  const lines = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    lines.push(
      <div
        key={`h-${hour}`}
        className="absolute left-0 right-0 border-t border-foreground/20 dark:border-foreground/25"
        style={{ top: (hour - START_HOUR) * hourHeight }}
      />
    );
    // Half-hour dashed line
    lines.push(
      <div
        key={`hh-${hour}`}
        className="absolute left-0 right-0 border-t border-dashed border-foreground/10 dark:border-foreground/15"
        style={{ top: (hour - START_HOUR) * hourHeight + hourHeight / 2 }}
      />
    );
  }
  // Bottom line
  lines.push(
    <div
      key="bottom"
      className="absolute left-0 right-0 border-t border-foreground/20 dark:border-foreground/25"
      style={{ top: TOTAL_HOURS * hourHeight }}
    />
  );
  return <>{lines}</>;
}

function AppointmentBlock({
  appointment,
  onClick,
  column,
  columnCount,
  hourHeight,
}: {
  appointment: Appointment;
  onClick: () => void;
  column: number;
  columnCount: number;
  hourHeight: number;
}) {
  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);
  const top = getTopOffset(start, hourHeight);
  const height = getBlockHeight(start, end, hourHeight);

  // Use the type color or a default
  const bgColor = appointment.typeColor || "#3b82f6";

  // Stagger overlapping appointments across columns so the bottom block stays
  // reachable. Each cluster splits available width evenly.
  const totalCols = Math.max(columnCount, 1);
  const widthPct = 100 / totalCols;
  const leftPct = column * widthPct;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute rounded-md px-2 py-1.5 text-left text-xs lg:text-sm overflow-hidden cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 min-h-11"
      style={{
        top,
        height: Math.max(height, 44),
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        backgroundColor: `${bgColor}20`,
        borderLeft: `3px solid ${bgColor}`,
      }}
    >
      <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
        <StatusDot status={appointment.status} />
        <span className="truncate">
          {appointment.patientName || "Unknown Patient"}
          {(appointment.clientFirstName || appointment.clientLastName) && (
            <span className="ml-1 italic font-normal text-muted-foreground">
              {[appointment.clientFirstName, appointment.clientLastName]
                .filter(Boolean)
                .join(" ")}
            </span>
          )}
        </span>
      </div>
      {height >= 36 && (
        <div className="text-muted-foreground truncate mt-0.5">
          {appointment.typeName || "Appointment"} &middot;{" "}
          {formatTime(start)} - {formatTime(end)}
        </div>
      )}
    </button>
  );
}

function AppointmentDetailPopover({
  appointment,
  onClose,
  onStatusChange,
  onEdit,
  isUpdating,
}: {
  appointment: Appointment;
  onClose: () => void;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  onEdit: () => void;
  isUpdating: boolean;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const clientName = [appointment.clientFirstName, appointment.clientLastName]
    .filter(Boolean)
    .join(" ") || "Unknown Client";

  const statusActions: { label: string; status: AppointmentStatus; variant: "default" | "outline" | "destructive" }[] = [];
  const current = appointment.status as AppointmentStatus;

  if (current === "scheduled" || current === "confirmed") {
    statusActions.push({ label: "Check In", status: "checked_in", variant: "default" });
    statusActions.push({ label: "No Show", status: "no_show", variant: "outline" });
    statusActions.push({ label: "Cancel", status: "cancelled", variant: "destructive" });
  } else if (current === "checked_in" || current === "in_exam") {
    statusActions.push({ label: "Check Out", status: "checked_out", variant: "default" });
    if (current === "checked_in") {
      statusActions.push({ label: "In Exam", status: "in_exam", variant: "outline" });
    }
    statusActions.push({ label: "No Show", status: "no_show", variant: "outline" });
  } else if (current === "no_show" || current === "cancelled") {
    statusActions.push({ label: "Reschedule", status: "scheduled", variant: "outline" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        ref={popoverRef}
        className="w-full max-w-sm rounded-lg border border-border bg-card shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusDot status={appointment.status} />
            <span className="text-sm font-medium">
              {STATUS_LABELS[current] || appointment.status}
            </span>
            {appointment.pendingOffline ? (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Queued
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          <div>
            <h3 className="font-semibold text-base">
              {appointment.patientName || "Unknown Patient"}
            </h3>
            {appointment.patientSpecies && (
              <p className="text-xs text-muted-foreground">{appointment.patientSpecies}</p>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>Client: {clientName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {formatTime(start)} - {formatTime(end)}
              </span>
            </div>
            {appointment.doctorName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>Dr. {appointment.doctorName}</span>
              </div>
            )}
            {appointment.typeName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{appointment.typeName}</span>
              </div>
            )}
            {appointment.roomName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="ml-0.5 h-3.5 w-3.5 text-center text-xs font-bold">#</span>
                <span>{appointment.roomName}</span>
              </div>
            )}
            {appointment.notes && (
              <p className="text-muted-foreground text-xs mt-1 bg-muted/50 rounded p-2">
                {appointment.notes}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {(statusActions.length > 0 || current === "scheduled" || current === "confirmed") && (
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            <Button size="sm" variant="outline" onClick={onEdit}>
              Edit
            </Button>
            {(current === "scheduled" || current === "confirmed") && (
              <SendReminderButton appointmentId={appointment.id} />
            )}
            {statusActions.map((action) => (
              <Button
                key={action.status}
                size="sm"
                variant={action.variant}
                disabled={isUpdating}
                onClick={() => onStatusChange(appointment.id, action.status)}
              >
                {isUpdating ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : null}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SendReminderButton({ appointmentId }: { appointmentId: string }) {
  const sendReminder = trpc.notifications.sendAppointmentReminder.useMutation({
    onSuccess: () => {
      toast.success("Reminder sent");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={sendReminder.isPending}
      onClick={() => sendReminder.mutate({ appointmentId })}
    >
      {sendReminder.isPending ? (
        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
      ) : (
        <Mail className="mr-1.5 h-3 w-3" />
      )}
      Send Reminder
    </Button>
  );
}

// --- Time slot helpers for booking form ---

function generateTimeSlots(): { label: string; value: string }[] {
  const slots: { label: string; value: string }[] = [];
  for (let hour = 8; hour <= 17; hour++) {
    for (const min of [0, 30]) {
      if (hour === 17 && min > 30) break;
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? "AM" : "PM";
      const label = `${h12}:${String(min).padStart(2, "0")} ${ampm}`;
      const value = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      slots.push({ label, value });
    }
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function BookingForm({
  onClose,
  defaultDate,
  defaultTime,
  editingAppointment,
}: {
  onClose: () => void;
  defaultDate: Date;
  defaultTime?: string;
  editingAppointment?: Appointment | null;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const isEditing = Boolean(editingAppointment);

  // Compute defaults from the appointment we're editing (if any)
  const initial = (() => {
    if (!editingAppointment) {
      return {
        date: toISODate(defaultDate),
        startTime: defaultTime || "09:00",
        duration: 30,
      };
    }
    const start = new Date(editingAppointment.startTime);
    const end = new Date(editingAppointment.endTime);
    const hh = String(start.getHours()).padStart(2, "0");
    const mm = String(start.getMinutes()).padStart(2, "0");
    return {
      date: toISODate(start),
      startTime: `${hh}:${mm}`,
      duration: Math.max(
        5,
        Math.round((end.getTime() - start.getTime()) / 60000)
      ),
    };
  })();

  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
  } | null>(
    editingAppointment && editingAppointment.patientId
      ? {
          id: editingAppointment.patientId,
          name: editingAppointment.patientName ?? "Patient",
          species: editingAppointment.patientSpecies ?? null,
          clientFirstName: editingAppointment.clientFirstName ?? null,
          clientLastName: editingAppointment.clientLastName ?? null,
        }
      : null
  );
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [doctorId, setDoctorId] = useState(editingAppointment?.doctorId ?? "");
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [duration, setDuration] = useState(initial.duration);
  const [notes, setNotes] = useState(editingAppointment?.notes ?? "");

  const debouncedSearch = useDebounce(patientSearch, 300);

  // Queries
  const { data: searchResults } = trpc.patients.search.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.length >= 1 }
  );
  const { data: appointmentTypes } = trpc.appointments.listTypes.useQuery();
  const { data: doctors } = trpc.appointments.listDoctors.useQuery();
  const { data: roomsList } = trpc.appointments.listRooms.useQuery();

  // Match the editing appointment's type/room by name once their lists load
  useEffect(() => {
    if (!editingAppointment || !appointmentTypes || typeId) return;
    const match = appointmentTypes.find(
      (t) => t.name === editingAppointment.typeName
    );
    if (match) setTypeId(match.id);
  }, [editingAppointment, appointmentTypes, typeId]);

  useEffect(() => {
    if (!editingAppointment || !roomsList || roomId) return;
    const match = roomsList.find(
      (r) => r.name === editingAppointment.roomName
    );
    if (match) setRoomId(match.id);
  }, [editingAppointment, roomsList, roomId]);

  const createAppointment = trpc.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Appointment created");
      utils.appointments.list.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const updateAppointment = trpc.appointments.update.useMutation({
    onSuccess: () => {
      toast.success("Appointment updated");
      utils.appointments.list.invalidate();
      onClose();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // When appointment type changes, update duration (skip on edit pre-fill)
  useEffect(() => {
    if (typeId && appointmentTypes) {
      const found = appointmentTypes.find((t) => t.id === typeId);
      if (found?.durationMinutes && !isEditing) {
        setDuration(found.durationMinutes);
      }
    }
  }, [typeId, appointmentTypes, isEditing]);

  // Close on escape / click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const isPending =
    createAppointment.isPending || updateAppointment.isPending;

  const handleSave = () => {
    const startDt = new Date(`${date}T${startTime}:00`);
    const endDt = new Date(startDt.getTime() + duration * 60 * 1000);

    if (isEditing && editingAppointment) {
      updateAppointment.mutate({
        id: editingAppointment.id,
        startTime: startDt.toISOString(),
        endTime: endDt.toISOString(),
        typeId: typeId || null,
        doctorId: doctorId || null,
        roomId: roomId || null,
        notes: notes || null,
      });
      return;
    }

    createAppointment.mutate({
      startTime: startDt.toISOString(),
      endTime: endDt.toISOString(),
      patientId: selectedPatient?.id,
      typeId: typeId || undefined,
      doctorId: doctorId || undefined,
      roomId: roomId || undefined,
      notes: notes || undefined,
    });
  };

  const clientName = selectedPatient
    ? [selectedPatient.clientFirstName, selectedPatient.clientLastName]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        ref={modalRef}
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">
            {isEditing ? "Edit Appointment" : "New Appointment"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-4">
          {/* Patient search */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Patient</label>
            {selectedPatient ? (
              <div className="mt-1 flex items-center gap-2 rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
                <span className="flex-1">
                  {selectedPatient.name}
                  {selectedPatient.species && (
                    <span className="text-muted-foreground"> ({selectedPatient.species})</span>
                  )}
                </span>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatient(null);
                      setPatientSearch("");
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative mt-1">
                <Input
                  placeholder="Search patients..."
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  className="h-9 text-sm"
                />
                {showPatientDropdown && searchResults && searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                        onClick={() => {
                          setSelectedPatient(p);
                          setShowPatientDropdown(false);
                          setPatientSearch("");
                        }}
                      >
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.species}
                          {(p.clientFirstName || p.clientLastName) && (
                            <> &middot; Owner: {[p.clientFirstName, p.clientLastName].filter(Boolean).join(" ")}</>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {clientName && (
              <p className="mt-1 text-xs text-muted-foreground">Client: {clientName}</p>
            )}
          </div>

          {/* Appointment Type */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Appointment Type</label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="mt-1 h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select type...</option>
              {appointmentTypes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.durationMinutes} min)
                </option>
              ))}
            </select>
          </div>

          {/* Doctor */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Doctor</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="mt-1 h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select doctor...</option>
              {doctors?.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  Dr. {doc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Room */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Room</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="mt-1 h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select room...</option>
              {roomsList?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>

          {/* Start Time */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Start Time</label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TIME_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
            <Input
              type="number"
              min={5}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 h-9 text-sm"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Optional notes..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            {isEditing ? "Save changes" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function SchedulePage() {
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT_DEFAULT);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () =>
      setHourHeight(mq.matches ? HOUR_HEIGHT_LG : HOUR_HEIGHT_DEFAULT);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingDefaultTime, setBookingDefaultTime] = useState<string | undefined>(undefined);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [cachedSchedule, setCachedSchedule] = useState<CachedSchedule | null>(
    null
  );
  const { online } = useNetworkStatus();

  const {
    data: appointments,
    isLoading,
    error,
    isError,
    refetch: refetchAppointments,
  } = trpc.appointments.list.useQuery({
    startDate: startOfDay(currentDate).toISOString(),
    endDate: endOfDay(currentDate).toISOString(),
    doctorId: doctorFilter !== "all" ? doctorFilter : undefined,
  });

  // Persist successful schedule fetches so the day is available offline.
  useEffect(() => {
    if (!appointments || error) return;
    if (doctorFilter !== "all") return; // Only cache the unfiltered schedule.
    const cacheable: CachedAppointment[] = appointments.map((appt) => ({
      ...appt,
      startTime:
        appt.startTime instanceof Date
          ? appt.startTime.toISOString()
          : appt.startTime,
      endTime:
        appt.endTime instanceof Date
          ? appt.endTime.toISOString()
          : appt.endTime,
    }));
    saveCachedSchedule(toISODate(currentDate), cacheable).catch((err) => {
      console.warn("Could not cache schedule for offline use:", err);
    });
  }, [appointments, error, currentDate, doctorFilter]);

  // Fallback to a cached schedule when the network query fails or returns
  // nothing while offline. Online data always wins when available, and we
  // never use the cache while the device reports it is online (otherwise a
  // transient API hiccup leaves a stale "offline snapshot" banner stuck).
  useEffect(() => {
    let cancelled = false;

    if (appointments) {
      setCachedSchedule(null);
      return;
    }

    if (online) {
      // While online, never substitute the cache for a live response. If the
      // query is failing, the user sees a normal error with a Retry button.
      setCachedSchedule(null);
      return;
    }

    if (!isLoading) {
      getCachedSchedule(toISODate(currentDate))
        .then((entry) => {
          if (!cancelled) setCachedSchedule(entry ?? null);
        })
        .catch(() => {
          if (!cancelled) setCachedSchedule(null);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [appointments, isError, isLoading, online, currentDate]);

  const displayAppointments: Appointment[] | null = appointments
    ? (appointments as unknown as Appointment[])
    : cachedSchedule
      ? (cachedSchedule.appointments as unknown as Appointment[])
      : null;
  const isShowingCache = !appointments && !!cachedSchedule && !online;
  const showOnlineLoadError = online && isError && !appointments;

  const { data: doctors } = trpc.appointments.listDoctors.useQuery();

  const updateStatus = trpc.appointments.updateStatus.useMutation();

  const utils = trpc.useUtils();

  const handleStatusChange = async (id: string, status: AppointmentStatus) => {
    try {
      const result = await runOrQueueMutation({
        target: "appointments.updateStatus",
        payload: { id, status },
        runOnline: (payload) => updateStatus.mutateAsync(payload),
      });

      // Reflect the new status in the cached schedule right away so both the
      // online table (when offline-fallback kicks in later) and the offline
      // chart context show the latest tap.
      await updateCachedAppointmentStatus({
        appointmentId: id,
        status,
        pendingOffline: result.status === "queued",
      });

      if (result.status === "online") {
        toast.success("Appointment status updated");
        setSelectedAppointment(null);
        utils.appointments.list.invalidate();
      } else {
        toast.success("Status saved offline and queued for sync.");
        setSelectedAppointment(null);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update status."
      );
    }
  };

  const goToday = () => setCurrentDate(startOfDay(new Date()));
  const goPrev = () => setCurrentDate((d) => addDays(d, -1));
  const goNext = () => setCurrentDate((d) => addDays(d, 1));

  const isToday =
    toISODate(currentDate) === toISODate(new Date());

  // Current time indicator position
  const now = new Date();
  const showNowLine =
    isToday && now.getHours() >= START_HOUR && now.getHours() < END_HOUR;
  const nowTop = getTopOffset(now, hourHeight);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Schedule</h2>
          <p className="text-sm text-muted-foreground">Appointment calendar</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={goPrev} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={isToday ? "secondary" : "outline"}
            size="sm"
            onClick={goToday}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goNext} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h3 className="text-sm font-medium">{formatDate(currentDate)}</h3>

        <div className="ml-auto flex items-center gap-2">
          {/* Doctor filter */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="h-9 appearance-none rounded-md border border-input bg-background pl-8 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Doctors</option>
              {doctors?.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  Dr. {doc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Prepare for field day */}
          <PrepareFieldDayButton
            currentDate={currentDate}
            appointments={displayAppointments ?? null}
            online={online}
          />

          {/* New Appointment button */}
          <Button
            size="sm"
            onClick={() => {
              setBookingDefaultTime(undefined);
              setShowBookingForm(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Online load error with retry — shown when the device thinks it is
          online but the schedule API call is failing. Avoids a misleading
          "Offline snapshot" banner when the user is in fact online. */}
      {showOnlineLoadError && (
        <div className="mt-4 flex items-start justify-between gap-2 rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <div>
            <p className="font-medium">Could not load schedule</p>
            <p className="mt-0.5 text-xs">
              {error?.message ??
                "The schedule could not be reached. Try again in a moment."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchAppointments()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Generic non-network error fallback (covers cases where data exists
          but the latest refetch failed). */}
      {error && !showOnlineLoadError && !isShowingCache && (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {/* Offline cache banner — only when the device is actually offline. */}
      {isShowingCache && cachedSchedule && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Offline snapshot</p>
            <p className="mt-0.5 text-xs">
              Showing the cached schedule from{" "}
              {new Date(cachedSchedule.cachedAt).toLocaleString()}. Reconnect
              to see live updates.
            </p>
          </div>
        </div>
      )}

      {/* Calendar body */}
      {isLoading && !isShowingCache ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading appointments...
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          {/* Day grid */}
          <div className="flex overflow-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
            {/* Time labels */}
            <TimeSlots hourHeight={hourHeight} />

            {/* Appointment area */}
            <div
              className="relative flex-1 border-l border-border cursor-pointer"
              style={{ height: TOTAL_HOURS * hourHeight }}
              onClick={(e) => {
                // Only handle clicks on the background, not on appointment blocks
                if ((e.target as HTMLElement).closest("button")) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const hoursFromTop = y / hourHeight;
                const totalMinutes = Math.round((START_HOUR + hoursFromTop) * 60);
                // Snap to nearest 30 min
                const snapped = Math.round(totalMinutes / 30) * 30;
                const hour = Math.floor(snapped / 60);
                const min = snapped % 60;
                const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
                setBookingDefaultTime(timeStr);
                setShowBookingForm(true);
              }}
            >
              <GridLines hourHeight={hourHeight} />

              {/* Current time indicator */}
              {showNowLine && (
                <div
                  className="absolute left-0 right-0 z-10 flex items-center"
                  style={{ top: nowTop }}
                >
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1" />
                  <div className="flex-1 border-t-2 border-red-500" />
                </div>
              )}

              {/* Appointment blocks */}
              {displayAppointments && displayAppointments.length > 0 ? (
                (() => {
                  const layout = layoutAppointments(displayAppointments);
                  return displayAppointments.map((appt) => {
                    const slot = layout.get(appt.id) ?? {
                      column: 0,
                      columnCount: 1,
                    };
                    return (
                      <AppointmentBlock
                        key={appt.id}
                        appointment={appt}
                        onClick={() => setSelectedAppointment(appt)}
                        column={slot.column}
                        columnCount={slot.columnCount}
                        hourHeight={hourHeight}
                      />
                    );
                  });
                })()
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Calendar className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No appointments for this day
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer with count */}
          {displayAppointments && displayAppointments.length > 0 && (
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {displayAppointments.length} appointment
              {displayAppointments.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Detail popover */}
      {selectedAppointment && (
        <AppointmentDetailPopover
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          onEdit={() => {
            setEditingAppointment(selectedAppointment);
            setSelectedAppointment(null);
          }}
          isUpdating={updateStatus.isPending}
        />
      )}

      {/* Booking form (create or edit) */}
      {(showBookingForm || editingAppointment) && (
        <BookingForm
          onClose={() => {
            setShowBookingForm(false);
            setEditingAppointment(null);
          }}
          defaultDate={currentDate}
          defaultTime={bookingDefaultTime}
          editingAppointment={editingAppointment}
        />
      )}
    </div>
  );
}

function PrepareFieldDayButton({
  currentDate,
  appointments,
  online,
}: {
  currentDate: Date;
  appointments: Appointment[] | null;
  online: boolean;
}) {
  const utils = trpc.useUtils();
  const [isPreparing, setIsPreparing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );

  const handlePrepare = async () => {
    if (!online) {
      toast.error("Connect to the network before preparing for field day.");
      return;
    }

    setIsPreparing(true);
    setProgress(null);
    try {
      // Re-fetch the day's appointments fresh and cache them.
      const fresh = await utils.appointments.list.fetch({
        startDate: startOfDay(currentDate).toISOString(),
        endDate: endOfDay(currentDate).toISOString(),
      });

      const cacheable: CachedAppointment[] = (fresh ?? []).map((appt) => ({
        ...appt,
        startTime:
          appt.startTime instanceof Date
            ? appt.startTime.toISOString()
            : appt.startTime,
        endTime:
          appt.endTime instanceof Date
            ? appt.endTime.toISOString()
            : appt.endTime,
      }));
      await saveCachedSchedule(toISODate(currentDate), cacheable);

      // Cache snapshots for every unique patient on the schedule.
      const seen = new Set<string>();
      const patientIds: string[] = [];
      for (const appt of fresh ?? appointments ?? []) {
        if (appt.patientId && !seen.has(appt.patientId)) {
          seen.add(appt.patientId);
          patientIds.push(appt.patientId);
        }
      }

      setProgress({ done: 0, total: patientIds.length });
      let cached = 0;
      let failed = 0;
      for (const id of patientIds) {
        try {
          const snapshot = await utils.patients.getOfflineSnapshot.fetch({ id });
          await saveCachedPatientSnapshot({
            patientId: id,
            patient: snapshot.patient,
            weights: snapshot.weights,
            allergies: snapshot.allergies,
            problems: snapshot.problems,
            vaccinations: snapshot.vaccinations,
            prescriptions: snapshot.prescriptions,
            soapNotes: snapshot.soapNotes,
            labResults: snapshot.labResults,
            procedures: snapshot.procedures,
            alerts: snapshot.alerts,
          });
          cached += 1;
        } catch (err) {
          console.warn(`Could not cache patient ${id}:`, err);
          failed += 1;
        }
        setProgress({ done: cached + failed, total: patientIds.length });
      }

      if (failed > 0) {
        toast.warning(
          `Cached ${cached} of ${patientIds.length} patient charts (${failed} failed).`
        );
      } else if (cached === 0) {
        toast.success("Schedule cached. No patient charts to download.");
      } else {
        toast.success(`Cached ${cached} patient chart${cached === 1 ? "" : "s"} for offline use.`);
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Could not prepare for field day."
      );
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handlePrepare}
      disabled={isPreparing}
      title="Cache today's schedule and patient charts for offline use"
    >
      {isPreparing ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : (
        <CloudDownload className="mr-1.5 h-3.5 w-3.5" />
      )}
      {isPreparing
        ? progress
          ? `Caching ${progress.done}/${progress.total}`
          : "Preparing..."
        : "Prepare for field day"}
    </Button>
  );
}
