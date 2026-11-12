"use client";

import { useState } from "react";
import { ClipboardList, Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  clientId: string;
  clientEmail: string | null | undefined;
};

const STATUS_STYLES: Record<string, string> = {
  not_sent: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-800",
  expired: "bg-red-100 text-red-700",
  completed: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABELS: Record<string, string> = {
  not_sent: "Not sent",
  pending: "Pending",
  expired: "Expired",
  completed: "Completed",
};

export function ClientIntakeInvite({ clientId, clientEmail }: Props) {
  const utils = trpc.useUtils();
  const [emailOverride, setEmailOverride] = useState("");
  const statusQuery = trpc.intake.getClientIntakeStatus.useQuery({ clientId });
  const submissionQuery = trpc.intake.getSubmission.useQuery(
    { clientId },
    { enabled: statusQuery.data?.status === "completed" }
  );

  const createInvite = trpc.intake.createInvite.useMutation({
    onSuccess: async (data) => {
      await utils.intake.getClientIntakeStatus.invalidate({ clientId });
      toast.success(`Intake invite emailed to ${data.email}`);
      try {
        await navigator.clipboard.writeText(data.intakeUrl);
        toast.message("Invite link copied");
      } catch {
        /* ignore */
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const status = statusQuery.data?.status ?? "not_sent";

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">
            New client paperwork
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Email a one-time link so this client can complete the agreement,
            media consent, and pet registration before the visit.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {statusQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading intake status…</p>
      ) : (
        <>
          {statusQuery.data?.latestInvite ? (
            <p className="mb-3 text-xs text-muted-foreground">
              Last invite to {statusQuery.data.latestInvite.email} on{" "}
              {new Date(
                statusQuery.data.latestInvite.createdAt
              ).toLocaleString()}
              {statusQuery.data.latestInvite.expiresAt
                ? ` · expires ${new Date(
                    statusQuery.data.latestInvite.expiresAt
                  ).toLocaleDateString()}`
                : ""}
            </p>
          ) : null}

          {submissionQuery.data ? (
            <div className="mb-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                Submitted{" "}
                {new Date(submissionQuery.data.submittedAt).toLocaleString()}
              </p>
              <p className="mt-1 text-muted-foreground">
                Agreement {submissionQuery.data.agreementVersion} · Media
                consent: {submissionQuery.data.mediaConsent ? "Yes" : "No"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {submissionQuery.data.signatures.length} signature(s) on file
              </p>
            </div>
          ) : null}

          {status !== "completed" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">
                  Email (optional override)
                </label>
                <Input
                  type="email"
                  placeholder={clientEmail || "client@email.com"}
                  value={emailOverride}
                  onChange={(e) => setEmailOverride(e.target.value)}
                />
              </div>
              <Button
                type="button"
                disabled={createInvite.isPending}
                onClick={() =>
                  createInvite.mutate({
                    clientId,
                    email: emailOverride.trim() || undefined,
                  })
                }
              >
                {createInvite.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : status === "pending" || status === "expired" ? (
                  <RefreshCw className="mr-2 h-4 w-4" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                {status === "not_sent" ? "Send intake invite" : "Resend invite"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardList className="h-4 w-4" />
              Intake complete. You can still resend if the client needs to
              update information for another pet later.
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-auto"
                disabled={createInvite.isPending}
                onClick={() =>
                  createInvite.mutate({
                    clientId,
                    email: emailOverride.trim() || undefined,
                  })
                }
              >
                Send new invite
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
