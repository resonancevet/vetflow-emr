"use client";

import { useEffect, useState } from "react";
import {
  countOfflineOutbox,
  OFFLINE_OUTBOX_CHANGED,
} from "@/lib/offline/outbox";

export function useNetworkStatus() {
  const [online, setOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const updateQueuedCount = () => {
      countOfflineOutbox()
        .then(setQueuedCount)
        .catch(() => setQueuedCount(0));
    };

    updateOnline();
    updateQueuedCount();

    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener(OFFLINE_OUTBOX_CHANGED, updateQueuedCount);

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener(OFFLINE_OUTBOX_CHANGED, updateQueuedCount);
    };
  }, []);

  return { online, queuedCount };
}
