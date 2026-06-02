"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listOfflineOutbox,
  removeOfflineOutboxItem,
  OFFLINE_OUTBOX_CHANGED,
  type OfflineOutboxItem,
} from "@/lib/offline/outbox";
import { OFFLINE_SYNC_REQUESTED } from "@/lib/offline/mutations";
import { useNetworkStatus } from "@/lib/offline/use-network-status";

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function asPayloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function describeItem(item: OfflineOutboxItem): {
  title: string;
  detail: string;
} {
  const payload = asPayloadRecord(item.payload);

  switch (item.target) {
    case "patients.addWeight":
      return {
        title: "Patient weight",
        detail: `${String(payload.weightKg ?? "unknown")} kg`,
      };
    case "records.createProblem":
      return {
        title: "Problem",
        detail: String(payload.description ?? "New problem"),
      };
    case "patientAlerts.create":
      return {
        title: "Alert",
        detail: String(payload.title ?? "New alert"),
      };
    case "appointments.updateStatus":
      return {
        title: "Appointment status",
        detail: String(payload.status ?? "status update").replaceAll("_", " "),
      };
    default:
      return {
        title: item.target,
        detail: item.kind,
      };
  }
}

export default function PendingSyncPage() {
  const [items, setItems] = useState<OfflineOutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { online } = useNetworkStatus();

  const failedCount = useMemo(
    () => items.filter((item) => item.lastError).length,
    [items]
  );

  const load = () => {
    setLoading(true);
    listOfflineOutbox()
      .then(setItems)
      .catch((error) => {
        console.error(error);
        toast.error("Could not read pending sync items.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    window.addEventListener(OFFLINE_OUTBOX_CHANGED, load);
    return () => window.removeEventListener(OFFLINE_OUTBOX_CHANGED, load);
  }, []);

  const requestSync = () => {
    if (!online) {
      toast.error("Reconnect before syncing.");
      return;
    }

    setSyncing(true);
    window.dispatchEvent(new Event(OFFLINE_SYNC_REQUESTED));
    toast.success("Sync requested.");
    window.setTimeout(() => {
      load();
      setSyncing(false);
    }, 1200);
  };

  const deleteItem = async (item: OfflineOutboxItem) => {
    if (!confirm("Remove this pending sync item? This cannot be undone.")) return;
    try {
      await removeOfflineOutboxItem(item);
      toast.success("Pending item removed.");
      load();
    } catch (error) {
      console.error(error);
      toast.error("Could not remove pending item.");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">Pending Sync</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Offline changes are saved locally here and automatically sync when
            this device reconnects.
          </p>
        </div>
        <Button onClick={requestSync} disabled={!online || syncing}>
          {syncing ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          Sync now
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Connection</p>
          <p className="mt-1 text-lg font-semibold">
            {online ? "Online" : "Offline"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="mt-1 text-lg font-semibold">{items.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Needs attention</p>
          <p className="mt-1 text-lg font-semibold">{failedCount}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pending items...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-green-600" />
          <p className="mt-3 font-medium">Everything is synced</p>
          <p className="mt-1 text-sm text-muted-foreground">
            There are no offline changes waiting on this device.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const description = describeItem(item);
            return (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{description.title}</p>
                      {item.lastError ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          Failed
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                          Queued
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {description.detail}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved {formatDateTime(item.createdAt)}
                      {item.attempts > 0 ? ` · ${item.attempts} attempt(s)` : ""}
                    </p>
                    {item.lastError ? (
                      <p className="mt-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                        {item.lastError}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteItem(item)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
