"use client";

import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type PickerView = "days" | "years" | "months";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function parseYmd(value: string): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function toYmd(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function formatDisplay(value: string) {
  const parsed = parseYmd(value);
  if (!parsed) return "";
  return `${pad2(parsed.m)}/${pad2(parsed.d)}/${parsed.y}`;
}

export function DateField({
  value,
  onChange,
  className,
  disabled,
  allowEmpty,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
}) {
  const selected = parseYmd(value);
  const today = useMemo(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
  }, []);

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PickerView>("days");
  const [viewYear, setViewYear] = useState(selected?.y ?? today.y);
  const [viewMonth, setViewMonth] = useState(selected?.m ?? today.m);

  const yearOptions = useMemo(() => {
    const start = today.y - 10;
    const end = today.y + 15;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [today.y]);

  const cells = useMemo(() => {
    const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
    const total = daysInMonth(viewYear, viewMonth);
    const blanks = Array.from({ length: firstDow }, () => null as number | null);
    const days = Array.from({ length: total }, (_, i) => i + 1);
    // Always 6 weeks so day-view height stays stable across months
    const filled = [...blanks, ...days];
    while (filled.length < 42) filled.push(null);
    return filled;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const date = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth() + 1);
  };

  const resetToDays = (y?: number, m?: number) => {
    if (y != null) setViewYear(y);
    if (m != null) setViewMonth(m);
    setView("days");
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
        if (next) {
          setViewYear(selected?.y ?? today.y);
          setViewMonth(selected?.m ?? today.m);
          setView("days");
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-8 w-[9.25rem] min-w-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-left text-sm",
            "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{formatDisplay(value) || "Select date"}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          avoidCollisions={false}
          className="z-50 w-[17.5rem] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none"
        >
          <div className="flex h-[19.5rem] flex-col">
            <div className="mb-2 flex h-7 shrink-0 items-center gap-1">
              {view === "days" ? (
                <>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                    onClick={() => shiftMonth(-1)}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="h-7 min-w-0 flex-1 rounded-md px-1 text-sm font-medium hover:bg-muted"
                    onClick={() => setView("years")}
                    aria-label="Choose month and year"
                  >
                    {MONTHS[viewMonth - 1]} {viewYear}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-muted"
                    onClick={() => shiftMonth(1)}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              ) : view === "years" ? (
                <>
                  <p className="flex-1 text-sm font-medium">Select year</p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setView("days")}
                  >
                    Back
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium hover:underline"
                    onClick={() => setView("years")}
                  >
                    {viewYear}
                  </button>
                  <span className="flex-1" />
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setView("years")}
                  >
                    Change year
                  </button>
                </>
              )}
            </div>

            <div className="min-h-0 flex-1">
              {view === "days" && (
                <>
                  <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted-foreground">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="py-1">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {cells.map((day, idx) => {
                      if (!day) {
                        return <div key={`e-${idx}`} className="h-8" />;
                      }
                      const isSelected =
                        selected?.y === viewYear &&
                        selected?.m === viewMonth &&
                        selected?.d === day;
                      const isToday =
                        today.y === viewYear &&
                        today.m === viewMonth &&
                        today.d === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          className={cn(
                            "h-8 rounded-md text-sm hover:bg-muted",
                            isSelected &&
                              "bg-primary text-primary-foreground hover:bg-primary/90",
                            !isSelected && isToday && "ring-1 ring-primary/40"
                          )}
                          onClick={() => {
                            onChange(toYmd(viewYear, viewMonth, day));
                            setOpen(false);
                          }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {view === "years" && (
                <div className="grid h-full grid-cols-3 content-start gap-1 overflow-y-auto">
                  {yearOptions.map((y) => (
                    <button
                      key={y}
                      type="button"
                      className={cn(
                        "h-9 rounded-md text-sm hover:bg-muted",
                        y === viewYear &&
                          "bg-primary text-primary-foreground hover:bg-primary/90",
                        y === today.y &&
                          y !== viewYear &&
                          "ring-1 ring-primary/40"
                      )}
                      onClick={() => {
                        setViewYear(y);
                        setView("months");
                      }}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}

              {view === "months" && (
                <div className="grid h-full grid-cols-3 content-start gap-1">
                  {MONTHS_SHORT.map((label, i) => {
                    const month = i + 1;
                    const isSelected =
                      selected?.y === viewYear && selected?.m === month;
                    const isCurrent =
                      today.y === viewYear && today.m === month;
                    return (
                      <button
                        key={label}
                        type="button"
                        className={cn(
                          "h-10 rounded-md text-sm hover:bg-muted",
                          isSelected &&
                            "bg-primary text-primary-foreground hover:bg-primary/90",
                          !isSelected && isCurrent && "ring-1 ring-primary/40"
                        )}
                        onClick={() => resetToDays(viewYear, month)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-2 flex shrink-0 items-center justify-between gap-2 border-t border-border pt-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onChange(toYmd(today.y, today.m, today.d));
                  setOpen(false);
                }}
              >
                Today
              </button>
              {allowEmpty ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              ) : (
                <span />
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
