"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Lightweight per-browser preference for which unit the vet enters weights in.
 * The database always stores kilograms; the unit only affects input UX, with
 * conversion applied right before the mutation fires.
 */

export type WeightUnit = "kg" | "lb";

const STORAGE_KEY = "vetroamer.weightUnit.v1";
const CHANGE_EVENT = "vetroamer:weight-unit-changed";
const LB_PER_KG = 2.2046226218487757;

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

/**
 * Convert a free-form numeric string in the chosen unit to a kilogram string
 * suitable for the `patients.addWeight` mutation. Returns null when the input
 * isn't a positive finite number.
 */
export function toKgString(value: string, unit: WeightUnit): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  const kg = unit === "lb" ? lbToKg(n) : n;
  // numeric(8,3) — three decimal places is plenty.
  return kg.toFixed(3);
}

function readFromStorage(): WeightUnit {
  if (typeof window === "undefined") return "kg";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "lb" ? "lb" : "kg";
  } catch {
    return "kg";
  }
}

function writeToStorage(unit: WeightUnit): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, unit);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage may be disabled (private mode); the preference degrades to
    // session-only.
  }
}

export function useWeightUnit(): [WeightUnit, (unit: WeightUnit) => void] {
  const [unit, setUnitState] = useState<WeightUnit>("kg");

  useEffect(() => {
    setUnitState(readFromStorage());

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setUnitState(readFromStorage());
    };
    const onLocal = () => setUnitState(readFromStorage());

    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, onLocal);
    };
  }, []);

  const setUnit = useCallback((next: WeightUnit) => {
    setUnitState(next);
    writeToStorage(next);
  }, []);

  return [unit, setUnit];
}
