"use client";

import { useState, useEffect, useRef } from "react";
import { Clock, User, X, Loader2, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// --- Types ---

type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "in_exam"
  | "checked_out"
  | "no_show"
  | "cancelled";

type WhiteboardAppointment = {
  id: string;
  status: string;
  startTime: Date | string;
  notes: string | null;
  patientName: string | null;
  patientSpecies: string | null;
  patientPhotoUrl: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  doctorName: string | null;
  roomName: string | null;
  typeName: string | null;
  typeColor: string | null;
};

// --- Constants ---

const COLUMNS = [
  {
    key: "waiting",
    label: "Waiting",
    statuses: ["confirmed"],
    color: "bg-blue-500",
    headerBg: "bg-blue-500/10",
    headerText: "text-blue-700 dark:text-blue-400",
  },
  {
    key: "in_progress",
    label: "In Progress",
    statuses: ["checked_in", "in_exam"],
    color: "bg-amber-500",
    headerBg: "bg-amber-500/10",
    headerText: "text-amber-700 dark:text-amber-400",
  },
  {
    key: "completed",
    label: "Completed",
    statuses: ["checked_out"],
    color: "bg-green-500",
    headerBg: "bg-green-500/10",
    headerText: "text-green-700 dark:text-green-400",
  },
] as const;

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  checked_in: "Checked In",
  in_exam: "In Exam",
  checked_out: "Checked Out",
  no_show: "No Show",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-500",
  confirmed: "bg-blue-500",
  checked_in: "bg-amber-500",
  in_exam: "bg-amber-500",
  checked_out: "bg-green-500",
  no_show: "bg-red-500",
  cancelled: "bg-red-500",
};

const SPECIES_EMOJI: Record<string, string> = {
  canine: "\uD83D\uDC36",
  feline: "\uD83D\uDC31",
  rabbit: "\uD83D\uDC30",
  avian: "\uD83D\uDC26",
  reptile: "\uD83E\uDD8E",
};

// --- Helpers ---

function getSpeciesEmoji(species: string | null): string {
  if (!species) return "\uD83D\uDC3E";
  return SPECIES_EMOJI[species.toLowerCase()] || "\uD83D\uDC3E";
}

function getTimeAgo(startTime: Date | string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 0) {
    const absMin = Math.abs(diffMin);
    if (absMin < 60) return `in ${absMin} min`;
    const hours = Math.floor(absMin / 60);
    return `in ${hours}h ${absMin % 60}m`;
  }
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (mins === 0) return `${hours}h ago`;
  return `${hours}h ${mins}m ago`;
}

function formatCurrentTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatCurrentDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// --- Components ---

function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      Live
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status as AppointmentStatus] || "bg-gray-400";
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full shrink-0", colorClass)}
    />
  );
}

function WhiteboardCard({
  appointment,
  onClick,
}: {
  appointment: WhiteboardAppointment;
  onClick: () => void;
}) {
  const clientName = [appointment.clientFirstName, appointment.clientLastName]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-border bg-card p-3 text-left transition-all hover:shadow-md hover:border-border/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
    >
      {/* Patient name + species */}
      <div className="flex items-center gap-2">
        <span className="text-base leading-none">
          {getSpeciesEmoji(appointment.patientSpecies)}
        </span>
        <span className="font-medium text-sm truncate">
          {appointment.patientName || "Unknown Patient"}
        </span>
        <StatusDot status={appointment.status} />
      </div>

      {/* Owner */}
      {clientName && (
        <p className="mt-1.5 text-xs text-muted-foreground truncate">
          {clientName}
        </p>
      )}

      {/* Details row */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {appointment.doctorName && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" />
            Dr. {appointment.doctorName}
          </span>
        )}
        {appointment.roomName && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {appointment.roomName}
          </span>
        )}
      </div>

      {/* Type + time */}
      <div className="mt-2 flex items-center justify-between">
        {appointment.typeName && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: appointment.typeColor
                ? `${appointment.typeColor}20`
                : undefined,
              color: appointment.typeColor || undefined,
            }}
          >
            {appointment.typeName}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {getTimeAgo(appointment.startTime)}
        </span>
      </div>
    </button>
  );
}

function AppointmentDetailModal({
  appointment,
  onClose,
  onStatusChange,
  isUpdating,
}: {
  appointment: WhiteboardAppointment;
  onClose: () => void;
  onStatusChange: (id: string, status: AppointmentStatus) => void;
  isUpdating: boolean;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const start = new Date(appointment.startTime);

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

  const clientName =
    [appointment.clientFirstName, appointment.clientLastName]
      .filter(Boolean)
      .join(" ") || "Unknown Client";

  const current = appointment.status as AppointmentStatus;

  const statusActions: {
    label: string;
    status: AppointmentStatus;
    variant: "default" | "outline" | "destructive";
  }[] = [];

  if (current === "confirmed") {
    statusActions.push({ label: "Check In", status: "checked_in", variant: "default" });
    statusActions.push({ label: "No Show", status: "no_show", variant: "outline" });
    statusActions.push({ label: "Cancel", status: "cancelled", variant: "destructive" });
  } else if (current === "checked_in") {
    statusActions.push({ label: "Start Exam", status: "in_exam", variant: "default" });
    statusActions.push({ label: "Check Out", status: "checked_out", variant: "outline" });
  } else if (current === "in_exam") {
    statusActions.push({ label: "Check Out", status: "checked_out", variant: "default" });
  } else if (current === "checked_out") {
    statusActions.push({
      label: "Back to Exam",
      status: "in_exam",
      variant: "outline",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        ref={modalRef}
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
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {getSpeciesEmoji(appointment.patientSpecies)}
            </span>
            <div>
              <h3 className="font-semibold text-base">
                {appointment.patientName || "Unknown Patient"}
              </h3>
              {appointment.patientSpecies && (
                <p className="text-xs text-muted-foreground capitalize">
                  {appointment.patientSpecies}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              <span>Client: {clientName}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {start.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}{" "}
                ({getTimeAgo(appointment.startTime)})
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
                <span
                  className="ml-0.5 h-3 w-3 rounded-full inline-block"
                  style={{
                    backgroundColor: appointment.typeColor || "#6b7280",
                  }}
                />
                <span>{appointment.typeName}</span>
              </div>
            )}
            {appointment.roomName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{appointment.roomName}</span>
              </div>
            )}
            {appointment.notes && (
              <p className="text-muted-foreground text-xs mt-1 bg-muted/50 rounded-lg p-2">
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

// --- Main Page ---

export default function WhiteboardPage() {
  const [selectedAppointment, setSelectedAppointment] =
    useState<WhiteboardAppointment | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // Auto-update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const {
    data: activeAppointments,
    isLoading,
    error,
  } = trpc.whiteboard.getActive.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const utils = trpc.useUtils();
  const updateStatus = trpc.whiteboard.updateStatus.useMutation({
    onSuccess: () => {
      setSelectedAppointment(null);
      utils.whiteboard.getActive.invalidate();
    },
  });

  const handleStatusChange = (id: string, status: AppointmentStatus) => {
    updateStatus.mutate({ id, status });
  };

  // Group appointments into columns
  const columnData = COLUMNS.map((col) => {
    const items = (activeAppointments || []).filter((appt) =>
      (col.statuses as readonly string[]).includes(appt.status as string)
    );
    return { ...col, items };
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-xl font-semibold">
              Practice Whiteboard
            </h2>
            <LiveIndicator />
          </div>
          <p className="text-sm text-muted-foreground">
            Live patient status board
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{formatCurrentTime(currentTime)}</p>
          <p className="text-xs text-muted-foreground">
            {formatCurrentDate(currentTime)}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="mt-12 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading whiteboard...
        </div>
      ) : (
        /* Kanban columns */
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {columnData.map((col) => (
            <div
              key={col.key}
              className="rounded-lg border border-border bg-muted/30"
            >
              {/* Column header */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-t-lg px-4 py-3",
                  col.headerBg
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn("h-2.5 w-2.5 rounded-full", col.color)}
                  />
                  <h3
                    className={cn(
                      "text-sm font-semibold",
                      col.headerText
                    )}
                  >
                    {col.label}
                  </h3>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    col.headerBg,
                    col.headerText
                  )}
                >
                  {col.items.length}
                </span>
              </div>

              {/* Column body */}
              <div className="space-y-3 p-3" style={{ minHeight: 120 }}>
                {col.items.length === 0 ? (
                  <div className="flex h-20 items-center justify-center">
                    <p className="text-xs text-muted-foreground">No patients</p>
                  </div>
                ) : (
                  col.items.map((appt) => (
                    <WhiteboardCard
                      key={appt.id}
                      appointment={appt}
                      onClick={() => setSelectedAppointment(appt)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onStatusChange={handleStatusChange}
          isUpdating={updateStatus.isPending}
        />
      )}
    </div>
  );
}
