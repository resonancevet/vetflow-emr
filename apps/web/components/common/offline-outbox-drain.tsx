"use client";

import { useEffect } from "react";
import { drainOfflineOutbox } from "@/lib/offline/mutations";

/**
 * Registers the reconnect hook for the offline outbox.
 * Replayers are added as individual forms become offline-aware.
 */
export function OfflineOutboxDrain() {
  useEffect(() => {
    const drain = () => {
      drainOfflineOutbox({}).catch((error) => {
        console.warn("Offline outbox drain failed", error);
      });
    };

    window.addEventListener("online", drain);
    window.addEventListener("focus", drain);
    drain();

    return () => {
      window.removeEventListener("online", drain);
      window.removeEventListener("focus", drain);
    };
  }, []);

  return null;
}
