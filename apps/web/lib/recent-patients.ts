"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Lightweight per-browser list of patients the current user has opened
 * recently. Stored in localStorage so we avoid round-tripping the database
 * on every navigation; this is a UX shortcut, not an audit trail.
 */

export type RecentPatient = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  /** ISO timestamp of the most recent view */
  viewedAt: string;
};

const STORAGE_KEY = "vetroamer.recentPatients.v1";
const MAX_ITEMS = 10;
const CHANGE_EVENT = "vetroamer:recent-patients-changed";

function readFromStorage(): RecentPatient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is RecentPatient =>
        typeof p === "object" &&
        p !== null &&
        typeof p.id === "string" &&
        typeof p.name === "string"
    );
  } catch {
    return [];
  }
}

function writeToStorage(items: RecentPatient[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage may be disabled (private mode); the feature degrades silently.
  }
}

export function recordPatientView(
  patient: Omit<RecentPatient, "viewedAt">
): void {
  const existing = readFromStorage();
  const filtered = existing.filter((p) => p.id !== patient.id);
  const next: RecentPatient[] = [
    { ...patient, viewedAt: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX_ITEMS);
  writeToStorage(next);
}

export function clearRecentPatients(): void {
  writeToStorage([]);
}

/**
 * React hook that subscribes to the recent patients list. Updates when this
 * tab writes via `recordPatientView` or when another tab updates storage.
 */
export function useRecentPatients(): RecentPatient[] {
  const [items, setItems] = useState<RecentPatient[]>([]);

  const refresh = useCallback(() => {
    setItems(readFromStorage());
  }, []);

  useEffect(() => {
    refresh();

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refresh();
    };
    const onLocalChange = () => refresh();

    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, onLocalChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, onLocalChange);
    };
  }, [refresh]);

  return items;
}
