"use client";

import { Cloud, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/lib/offline/use-network-status";

export function OfflineStatusPill() {
  const { online, queuedCount } = useNetworkStatus();

  if (online && queuedCount === 0) {
    return (
      <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 md:inline-flex dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
        <Cloud className="h-3.5 w-3.5" />
        Online
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium",
        online
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
          : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
      )}
    >
      {online ? (
        <Cloud className="h-3.5 w-3.5" />
      ) : (
        <CloudOff className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {online ? "Sync pending" : "Offline"}
      </span>
      {queuedCount > 0 && <span>{queuedCount} queued</span>}
    </span>
  );
}
