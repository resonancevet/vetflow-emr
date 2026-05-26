"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  PawPrint,
  Users,
  Calendar,
  X,
  Search,
  Package,
  DollarSign,
  BarChart3,
  Settings,
  Clipboard,
  Mail,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

const speciesEmoji: Record<string, string> = {
  canine: "\uD83D\uDC36",
  feline: "\uD83D\uDC31",
  avian: "\uD83D\uDC26",
  rabbit: "\uD83D\uDC30",
  reptile: "\uD83E\uDD8E",
  equine: "\uD83D\uDC34",
  other: "\uD83D\uDC3E",
};

export function CommandSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebounce(search, 200);
  const hasQuery = debouncedSearch.trim().length >= 1;

  const patients = trpc.patients.search.useQuery(
    { query: debouncedSearch },
    { enabled: open && hasQuery }
  );

  const clients = trpc.clients.search.useQuery(
    { query: debouncedSearch },
    { enabled: open && hasQuery }
  );

  const isSearching =
    hasQuery && (patients.isFetching || clients.isFetching);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  function navigate(path: string) {
    onClose();
    router.push(path);
  }

  if (!open) return null;

  const patientResults = patients.data ?? [];
  const clientResults = clients.data ?? [];
  const hasResults = patientResults.length > 0 || clientResults.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" role="dialog" aria-label="Search" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-background shadow-elevated">
        <Command className="flex flex-col" shouldFilter={!hasQuery}>
          <div className="flex items-center border-b border-border px-3">
            {isSearching ? (
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search patients, clients, or navigate..."
              className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            {hasQuery && !isSearching && !hasResults && (
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
                No patients or clients found.
              </Command.Empty>
            )}

            {/* Live search results */}
            {hasQuery && patientResults.length > 0 && (
              <Command.Group
                heading="Patients"
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {patientResults.map((patient) => (
                  <Command.Item
                    key={patient.id}
                    value={`patient-${patient.id}`}
                    onSelect={() => navigate(`/patients/${patient.id}`)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                  >
                    <span className="text-base">
                      {speciesEmoji[patient.species ?? "other"] ?? "\uD83D\uDC3E"}
                    </span>
                    <span className="font-medium">{patient.name}</span>
                    {patient.breed && (
                      <span className="text-muted-foreground">
                        {patient.breed}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {hasQuery && clientResults.length > 0 && (
              <Command.Group
                heading="Clients"
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {clientResults.map((client) => (
                  <Command.Item
                    key={client.id}
                    value={`client-${client.id}`}
                    onSelect={() => navigate(`/clients/${client.id}`)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                  >
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {client.firstName} {client.lastName}
                    </span>
                    {client.email && (
                      <span className="text-muted-foreground">
                        {client.email}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navigation (shown when no search query) */}
            {!hasQuery && (
              <Command.Group
                heading="Navigation"
                className="mb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                <Command.Item
                  onSelect={() => navigate("/")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/patients")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <PawPrint className="h-4 w-4" />
                  Patients
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/clients")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Users className="h-4 w-4" />
                  Clients
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/schedule")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/whiteboard")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Clipboard className="h-4 w-4" />
                  Whiteboard
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/billing")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <DollarSign className="h-4 w-4" />
                  Billing
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/inventory")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Package className="h-4 w-4" />
                  Inventory
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/inbox")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Mail className="h-4 w-4" />
                  Inbox
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/settings")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Command.Item>
              </Command.Group>
            )}

            {/* Quick actions always visible */}
            {!hasQuery && (
              <Command.Group
                heading="Quick Actions"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                <Command.Item
                  onSelect={() => navigate("/clients/new")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <Users className="h-4 w-4" />
                  New Client
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/patients/new")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <PawPrint className="h-4 w-4" />
                  New Patient
                </Command.Item>
                <Command.Item
                  onSelect={() => navigate("/billing/new")}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  <DollarSign className="h-4 w-4" />
                  New Invoice
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
