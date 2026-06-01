"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.update().catch(() => {
          // Update checks are best-effort; the existing worker can still serve.
        });
        return navigator.serviceWorker.ready;
      })
      .then(() => {
        // iPad Safari can install a worker without letting it control the
        // already-open tab. One reload after activation makes offline
        // navigation reliable without looping.
        if (
          !navigator.serviceWorker.controller &&
          sessionStorage.getItem("vetroamer-sw-controlled") !== "1"
        ) {
          sessionStorage.setItem("vetroamer-sw-controlled", "1");
          window.location.reload();
        }
      })
      .catch((error) => {
        console.warn("Service worker registration failed", error);
      });
  }, []);

  return null;
}
