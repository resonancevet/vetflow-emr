"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CallbackAppointmentRequestPanel } from "@/components/dashboard/appointment-request-modals";

export type CallbackRequestPayload = {
  id: string;
  patientId: string | null;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  patientName: string | null;
  patientSpecies: string | null;
  patientBreed: string | null;
  patientSex: string | null;
  patientDob: string | Date | null;
  preferredDate: string | null;
  preferredTime: string | null;
  reason: string | null;
  clientEmail: string | null;
  needsCallback?: boolean;
};

type CallbackPanelContextValue = {
  request: CallbackRequestPayload | null;
  openCallback: (request: CallbackRequestPayload) => void;
  closeCallback: () => void;
};

const CallbackPanelContext = createContext<CallbackPanelContextValue | null>(
  null
);

export function CallbackPanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [request, setRequest] = useState<CallbackRequestPayload | null>(null);

  const openCallback = useCallback((next: CallbackRequestPayload) => {
    setRequest(next);
  }, []);

  const closeCallback = useCallback(() => {
    setRequest(null);
  }, []);

  useEffect(() => {
    if (!request) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCallback();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request, closeCallback]);

  const value = useMemo(
    () => ({ request, openCallback, closeCallback }),
    [request, openCallback, closeCallback]
  );

  return (
    <CallbackPanelContext.Provider value={value}>
      <div className={request ? "md:pr-96" : undefined}>{children}</div>
      <CallbackAppointmentRequestPanel
        request={request}
        onClose={closeCallback}
      />
    </CallbackPanelContext.Provider>
  );
}

export function useCallbackPanel() {
  const ctx = useContext(CallbackPanelContext);
  if (!ctx) {
    throw new Error("useCallbackPanel must be used within CallbackPanelProvider");
  }
  return ctx;
}
