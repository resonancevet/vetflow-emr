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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// --- Constants ---

const START_HOUR = 8;
const END_HOUR = 18;
const HOUR_HEIGHT = 60; // px per hour
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

function getTopOffset(time: Date): number {
  const hours = time.getHours() + time.getMinutes() / 60;
  return (hours - START_HOUR) * HOUR_HEIGHT;
}

function getBlockHeight(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return Math.max(diffHours * HOUR_HEIGHT, 20); // min 20px
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

function TimeSlots() {
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
        style={{ height: hour < END_HOUR ? HOUR_HEIGHT : 0 }}
      >
        <span className="absolute -top-3 right-3 text-xs text-muted-foreground select-none">
          {label}
        </span>
      </div>
    );
  }
  return <div className="w-16 shrink-0 pt-0">{slots}</div>;
}

function GridLines() {
  const lines = [];
  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    lines.push(
      <div
        key={`h-${hour}`}
        className="absolute left-0 right-0 border-t border-border"
        style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
      />
    );
    // Half-hour dashed line
    lines.push(
      <div
        key={`hh-${hour}`}
        className="absolute left-0 right-0 border-t border-border/40 border-dashed"
        style={{ top: (hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
      />
    );
  }
  // Bottom line
  lines.push(
    <div
      key="bottom"
      className="absolute left-0 right-0 border-t border-border"
      style={{ top: TOTAL_HOURS * HOUR_HEIGHT }}
    />
  );
  return <>{lines}</>;
}

function AppointmentBlock({
  appointment,
  onClick,
}: {
  appointment: Appointment;
  onClick: () => void;
}) {
  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);
  const top = getTopOffset(start);
  const height = getBlockHeight(start, end);

  // Use the type color or a default
  const bgColor = appointment.typeColor || "#3b82f6";

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-1 right-1 rounded-md px-2 py-1 text-left text-xs overflow-hidden cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
      style={{
        top,
        height,
        backgroundColor: `${bgColor}20`,
        borderLeft: `3px solid ${bgColor}`,
      }}
    >
      <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
        <StatusDot status={appointment.status} />
        <span className="truncate">{appointment.patientName || "Unknown Patient"}</span>
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
  isUpdating,
}: {
  appointment: Appointment;
  onClose: () => void;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
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
        {statusActions.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
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
}: {
  onClose: () => void;
  defaultDate: Date;
  defaultTime?: string;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  // Form state
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    species: string | null;
    clientFirstName: string | null;
    clientLastName: string | null;
  } | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [typeId, setTypeId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(toISODate(defaultDate));
  const [startTime, setStartTime] = useState(defaultTime || "09:00");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");

  const debouncedSearch = useDebounce(patientSearch, 300);

  // Queries
  const { data: searchResults } = trpc.patients.search.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.length >= 1 }
  );
  const { data: appointmentTypes } = trpc.appointments.listTypes.useQuery();
  const { data: doctors } = trpc.appointments.listDoctors.useQuery();
  const { data: roomsList } = trpc.appointments.listRooms.useQuery();

  const createAppointment = trpc.appointments.create.useMutation({
    onSuccess: () => {
      utils.appointments.list.invalidate();
      onClose();
    },
  });

  // When appointment type changes, update duration
  useEffect(() => {
    if (typeId && appointmentTypes) {
      const found = appointmentTypes.find((t) => t.id === typeId);
      if (found?.durationMinutes) {
        setDuration(found.durationMinutes);
      }
    }
  }, [typeId, appointmentTypes]);

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

  const handleSave = () => {
    const startDt = new Date(`${date}T${startTime}:00`);
    const endDt = new Date(startDt.getTime() + duration * 60 * 1000);

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
          <h3 className="text-sm font-semibold">New Appointment</h3>
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
          <Button
            size="sm"
            onClick={handleSave}
            disabled={createAppointment.isPending}
          >
            {createAppointment.isPending && (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            )}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date()));
  const [view, setView] = useState<"day" | "week">("day");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingDefaultTime, setBookingDefaultTime] = useState<string | undefined>(undefined);

  const { data: appointments, isLoading, error } = trpc.appointments.list.useQuery({
    startDate: startOfDay(currentDate).toISOString(),
    endDate: endOfDay(currentDate).toISOString(),
    doctorId: doctorFilter !== "all" ? doctorFilter : undefined,
  });

  const { data: doctors } = trpc.appointments.listDoctors.useQuery();

  const updateStatus = trpc.appointments.updateStatus.useMutation({
    onSuccess: () => {
      setSelectedAppointment(null);
    },
  });

  const utils = trpc.useUtils();

  const handleStatusChange = (id: string, status: AppointmentStatus) => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => {
          utils.appointments.list.invalidate();
        },
      }
    );
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
  const nowTop = getTopOffset(now);

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
          {/* View toggle */}
          <div className="flex rounded-md border border-border">
            <button
              type="button"
              onClick={() => setView("day")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors rounded-l-md",
                view === "day"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setView("week")}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors rounded-r-md border-l border-border",
                view === "week"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              Week
            </button>
          </div>

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

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {/* Calendar body */}
      {view === "week" ? (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <Calendar className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-muted-foreground">Week view coming soon</p>
        </div>
      ) : isLoading ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading appointments...
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          {/* Day grid */}
          <div className="flex overflow-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
            {/* Time labels */}
            <TimeSlots />

            {/* Appointment area */}
            <div
              className="relative flex-1 border-l border-border cursor-pointer"
              style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
              onClick={(e) => {
                // Only handle clicks on the background, not on appointment blocks
                if ((e.target as HTMLElement).closest("button")) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const y = e.clientY - rect.top;
                const hoursFromTop = y / HOUR_HEIGHT;
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
              <GridLines />

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
              {appointments && appointments.length > 0 ? (
                appointments.map((appt) => (
                  <AppointmentBlock
                    key={appt.id}
                    appointment={appt}
                    onClick={() => setSelectedAppointment(appt)}
                  />
                ))
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
          {appointments && appointments.length > 0 && (
            <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
              {appointments.length} appointment{appointments.length !== 1 ? "s" : ""}
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
          isUpdating={updateStatus.isPending}
        />
      )}

      {/* Booking form */}
      {showBookingForm && (
        <BookingForm
          onClose={() => setShowBookingForm(false)}
          defaultDate={currentDate}
          defaultTime={bookingDefaultTime}
        />
      )}
    </div>
  );
}
