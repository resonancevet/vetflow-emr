"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Mail, MessageSquarePlus, Phone, MapPin } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  CommunicationList,
  LogCommunicationModal,
  type CommunicationListItem,
} from "@/components/communications/log-communication-modal";
import { ClientAlertsBanner } from "@/components/clients/client-alerts-banner";

const speciesEmoji: Record<string, string> = {
  canine: "\uD83D\uDC36",
  feline: "\uD83D\uDC31",
  avian: "\uD83D\uDC26",
  rabbit: "\uD83D\uDC30",
  reptile: "\uD83E\uDD8E",
  equine: "\uD83D\uDC34",
  other: "\uD83D\uDC3E",
};

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [commModalOpen, setCommModalOpen] = useState(false);
  const [editingComm, setEditingComm] =
    useState<CommunicationListItem | null>(null);

  const { data: client, isLoading, error } = trpc.clients.getById.useQuery(
    { id: params.id },
    { enabled: !!params.id }
  );

  const { data: communications, isLoading: commLoading } =
    trpc.communications.getByClient.useQuery(
      { clientId: params.id },
      { enabled: !!params.id }
    );

  if (isLoading) {
    return (
      <div className="text-center text-muted-foreground py-12">Loading...</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  if (!client) return null;

  const address = [client.address, client.city, client.state, client.zip]
    .filter(Boolean)
    .join(", ");

  const clientLabel = `${client.firstName} ${client.lastName}`;

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/clients")}
        className="mb-4 min-h-11"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Clients
      </Button>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold">
              {client.firstName} {client.lastName}
            </h2>
            <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
              {client.email && (
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {client.phone}
                </span>
              )}
              {address && (
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {address}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={() => router.push(`/clients/${client.id}/edit`)}
          >
            Edit
          </Button>
        </div>
      </div>

      <ClientAlertsBanner clientId={client.id} canManage />

      <div className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-heading text-lg font-semibold">Communications</h3>
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            onClick={() => {
              setEditingComm(null);
              setCommModalOpen(true);
            }}
          >
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Log call / message
          </Button>
        </div>
        {commLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <CommunicationList
            items={communications ?? []}
            emptyMessage="No communications logged for this client yet."
            clientId={client.id}
            onEdit={(item) => {
              setEditingComm(item);
              setCommModalOpen(true);
            }}
          />
        )}
      </div>

      <div className="mt-6">
        <h3 className="font-heading text-lg font-semibold mb-4">
          Patients ({client.patients.length})
        </h3>
        {client.patients.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {client.patients.map((patient) => (
              <div
                key={patient.id}
                onClick={() => router.push(`/patients/${patient.id}`)}
                className="cursor-pointer rounded-lg border border-border bg-card p-4 hover:bg-muted/30 transition-colors min-h-[4.5rem]"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {speciesEmoji[patient.species ?? "other"] ?? "\uD83D\uDC3E"}
                  </span>
                  <span className="font-medium">{patient.name}</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {patient.species &&
                    patient.species.charAt(0).toUpperCase() +
                      patient.species.slice(1)}
                  {patient.breed ? ` \u00B7 ${patient.breed}` : ""}
                </div>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      patient.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : patient.status === "deceased"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {patient.status ?? "active"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              No patients for this client yet
            </p>
            <Button
              variant="outline"
              className="mt-3 min-h-11"
              onClick={() => router.push("/patients/new")}
            >
              Add Patient
            </Button>
          </div>
        )}
      </div>

      <LogCommunicationModal
        open={commModalOpen}
        onClose={() => {
          setCommModalOpen(false);
          setEditingComm(null);
        }}
        clientId={client.id}
        clientLabel={clientLabel}
        editingItem={
          editingComm
            ? {
                id: editingComm.id,
                channel: editingComm.channel,
                direction: editingComm.direction,
                subject: editingComm.subject,
                content: editingComm.content,
                patientId: editingComm.patientId ?? null,
                updatedAt: editingComm.updatedAt,
              }
            : null
        }
      />
    </div>
  );
}
