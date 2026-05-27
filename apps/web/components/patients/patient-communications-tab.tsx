"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  CommunicationList,
  LogCommunicationModal,
  type CommunicationListItem,
} from "@/components/communications/log-communication-modal";

export function PatientCommunicationsTab({
  patientId,
  clientId,
  clientLabel,
}: {
  patientId: string;
  clientId: string;
  clientLabel: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] =
    useState<CommunicationListItem | null>(null);
  const { data: items, isLoading } = trpc.communications.getByPatient.useQuery({
    patientId,
  });

  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Loading...</div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Calls and messages linked to this patient.
        </p>
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          onClick={() => {
            setEditingItem(null);
            setModalOpen(true);
          }}
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Log call / message
        </Button>
      </div>

      <CommunicationList
        items={items ?? []}
        clientId={clientId}
        onEdit={(item) => {
          setEditingItem(item);
          setModalOpen(true);
        }}
      />

      <LogCommunicationModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        clientId={clientId}
        patientId={patientId}
        clientLabel={clientLabel}
        editingItem={
          editingItem
            ? {
                id: editingItem.id,
                channel: editingItem.channel,
                direction: editingItem.direction,
                subject: editingItem.subject,
                content: editingItem.content,
                patientId: editingItem.patientId ?? null,
                updatedAt: editingItem.updatedAt,
              }
            : null
        }
      />
    </div>
  );
}
