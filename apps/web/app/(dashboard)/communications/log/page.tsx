"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { LogCommunicationModal } from "@/components/communications/log-communication-modal";

export default function LogCommunicationPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-muted-foreground">Loading...</div>
      }
    >
      <LogCommunicationPageContent />
    </Suspense>
  );
}

function LogCommunicationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillClientId = searchParams.get("clientId") ?? "";
  const prefillPatientId = searchParams.get("patientId") ?? "";

  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState(prefillClientId);
  const [selectedPatientId, setSelectedPatientId] = useState(prefillPatientId);
  const [modalOpen, setModalOpen] = useState(!!prefillClientId);

  const { data: searchResults } = trpc.clients.search.useQuery(
    { query },
    { enabled: query.length >= 2 }
  );

  const { data: client } = trpc.clients.getById.useQuery(
    { id: selectedClientId },
    { enabled: !!selectedClientId }
  );

  const clientLabel = client
    ? `${client.firstName} ${client.lastName}`
    : undefined;

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="font-heading text-xl font-semibold">Log communication</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Search for a client, then record a phone call, text, or email.
      </p>

      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 min-h-11"
        />
      </div>

      {searchResults && searchResults.length > 0 && (
        <ul className="mt-2 rounded-lg border border-border bg-card divide-y divide-border">
          {searchResults.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left text-sm hover:bg-muted/50 min-h-11"
                onClick={() => {
                  setSelectedClientId(c.id);
                  setSelectedPatientId("");
                  setModalOpen(true);
                  setQuery("");
                }}
              >
                {c.firstName} {c.lastName}
                {c.phone ? (
                  <span className="ml-2 text-muted-foreground">{c.phone}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedClientId && (
        <LogCommunicationModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            if (!prefillClientId) {
              setSelectedClientId("");
            } else {
              router.back();
            }
          }}
          clientId={selectedClientId}
          patientId={selectedPatientId || undefined}
          clientLabel={clientLabel}
          onSuccess={() => router.push(`/clients/${selectedClientId}`)}
        />
      )}
    </div>
  );
}
