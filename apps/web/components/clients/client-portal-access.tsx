"use client";

import { useState } from "react";
import { Copy, Link2, Mail, RefreshCw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

type Props = {
  clientId: string;
  clientEmail: string | null | undefined;
  portalEnabled: boolean;
  portalUrl: string | null;
};

export function ClientPortalAccess({
  clientId,
  clientEmail,
  portalEnabled,
  portalUrl,
}: Props) {
  const utils = trpc.useUtils();
  const [busy, setBusy] = useState(false);

  const invalidate = () =>
    utils.clients.getById.invalidate({ id: clientId });

  const ensure = trpc.clients.ensurePortalAccess.useMutation({
    onSuccess: async (data) => {
      await invalidate();
      toast.success("Portal access enabled");
      if (data.portalUrl) {
        try {
          await navigator.clipboard.writeText(data.portalUrl);
          toast.message("Portal link copied");
        } catch {
          /* ignore */
        }
      }
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setBusy(false),
  });

  const regenerate = trpc.clients.regeneratePortalToken.useMutation({
    onSuccess: async (data) => {
      await invalidate();
      toast.success("New portal link created — old link no longer works");
      if (data.portalUrl) {
        try {
          await navigator.clipboard.writeText(data.portalUrl);
          toast.message("New link copied");
        } catch {
          /* ignore */
        }
      }
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setBusy(false),
  });

  const disable = trpc.clients.disablePortalAccess.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Portal access disabled");
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setBusy(false),
  });

  const emailLink = trpc.clients.emailPortalLink.useMutation({
    onSuccess: async (data) => {
      await invalidate();
      toast.success(
        data.emailId
          ? `Portal link emailed (id: ${data.emailId})`
          : "Portal link emailed"
      );
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setBusy(false),
  });

  const copyLink = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success("Portal link copied");
    } catch {
      toast.error("Could not copy — select the link manually");
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Pet portal</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Share a private link so this client can view pets, vaccines, and
            invoices.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            portalEnabled
              ? "bg-emerald-100 text-emerald-700"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {portalEnabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {portalEnabled && portalUrl ? (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <code className="min-w-0 flex-1 truncate text-xs text-foreground">
            {portalUrl}
          </code>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!portalEnabled ? (
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              ensure.mutate({ id: clientId });
            }}
          >
            Enable portal access
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={busy}
              onClick={() => void copyLink()}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy link
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={busy || !clientEmail}
              title={
                !clientEmail
                  ? "Add an email on the client record first"
                  : undefined
              }
              onClick={() => {
                setBusy(true);
                emailLink.mutate({ id: clientId });
              }}
            >
              <Mail className="mr-2 h-4 w-4" />
              Email link
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    "Create a new portal link? The current link will stop working immediately."
                  )
                ) {
                  return;
                }
                setBusy(true);
                regenerate.mutate({ id: clientId });
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    "Disable portal access? The current link will stop working."
                  )
                ) {
                  return;
                }
                setBusy(true);
                disable.mutate({ id: clientId });
              }}
            >
              <ShieldOff className="mr-2 h-4 w-4" />
              Disable
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
