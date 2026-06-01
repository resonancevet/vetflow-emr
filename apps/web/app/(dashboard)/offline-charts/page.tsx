"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, NotebookText, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type CachedPatientSnapshot,
  listCachedPatientSnapshots,
  OFFLINE_CACHE_CHANGED,
  removeCachedPatientSnapshot,
} from "@/lib/offline/cache";

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function ownerLabel(snapshot: CachedPatientSnapshot): string {
  const first = snapshot.patient.clientFirstName ?? "";
  const last = snapshot.patient.clientLastName ?? "";
  return `${first} ${last}`.trim() || "No owner on file";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(
        new Error(
          "Offline chart storage is taking longer than expected. Try Retry, or fully close and reopen Safari."
        )
      );
    }, ms);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export default function OfflineChartsPage() {
  const [snapshots, setSnapshots] = useState<CachedPatientSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await withTimeout(listCachedPatientSnapshots(), 7000);
      setSnapshots(rows);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unable to read offline charts."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {
      // load already sets the error state
    });
    const handle = () => {
      load().catch(() => {
        // load already sets the error state
      });
    };
    window.addEventListener(OFFLINE_CACHE_CHANGED, handle);
    return () => window.removeEventListener(OFFLINE_CACHE_CHANGED, handle);
  }, []);

  const removeOne = async (snapshot: CachedPatientSnapshot) => {
    if (!confirm(`Remove cached chart for ${snapshot.patient.name}?`)) return;
    try {
      await removeCachedPatientSnapshot(snapshot.patientId);
      toast.success("Cached chart removed.");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Could not remove cached chart.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Offline Charts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only patient charts saved on this device for use without
            service. Cache them in advance from the Schedule page using
            &ldquo;Prepare for field day&rdquo;.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            load().catch(() => {
              // load already sets the error state
            });
          }}
        >
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading cached charts...
        </div>
      ) : error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">Offline charts did not load.</p>
          <p className="mt-1 text-xs">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              load().catch(() => {
                // load already sets the error state
              });
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry loading charts
          </Button>
        </div>
      ) : snapshots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <NotebookText className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No offline charts yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cache patients from the Schedule page or open a patient online to
            save it for offline viewing.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              load().catch(() => {
                // load already sets the error state
              });
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Check again
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {snapshots.map((snapshot) => (
            <li
              key={snapshot.patientId}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/offline-charts/${snapshot.patientId}`}
                    onClick={(event) => {
                      if (
                        typeof navigator !== "undefined" &&
                        !navigator.onLine
                      ) {
                        event.preventDefault();
                        window.location.assign(
                          `/offline-charts/${snapshot.patientId}`
                        );
                      }
                    }}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {snapshot.patient.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {snapshot.patient.species ?? "-"}
                    {snapshot.patient.breed ? ` \u00B7 ${snapshot.patient.breed}` : ""}
                    {" \u00B7 "}
                    Owner: {ownerLabel(snapshot)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cached {formatRelative(snapshot.cachedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOne(snapshot)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
