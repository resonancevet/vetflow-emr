"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

export function QuickBooksSettings() {
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const status = trpc.quickbooks.status.useQuery();
  const accounts = trpc.quickbooks.listAccounts.useQuery(undefined, {
    enabled: Boolean(status.data?.connected),
  });
  const [incomeAccountId, setIncomeAccountId] = useState("");
  const [depositAccountId, setDepositAccountId] = useState("");

  useEffect(() => {
    if (!status.data?.connected) return;
    setIncomeAccountId(status.data.incomeAccountId ?? "");
    setDepositAccountId(status.data.depositAccountId ?? "");
  }, [
    status.data?.connected,
    status.data?.incomeAccountId,
    status.data?.depositAccountId,
  ]);

  useEffect(() => {
    const qb = searchParams.get("qb");
    if (!qb) return;
    if (qb === "connected") {
      toast.success("QuickBooks connected");
      utils.quickbooks.status.invalidate();
    } else if (qb === "error") {
      toast.error(
        searchParams.get("message") || "QuickBooks connection failed"
      );
    }
  }, [searchParams, utils.quickbooks.status]);

  const saveMapping = trpc.quickbooks.saveAccountMapping.useMutation({
    onSuccess: () => {
      toast.success("QuickBooks account mapping saved");
      utils.quickbooks.status.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const disconnect = trpc.quickbooks.disconnect.useMutation({
    onSuccess: () => {
      toast.success("QuickBooks disconnected");
      utils.quickbooks.status.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const syncRecent = trpc.quickbooks.syncRecentInvoices.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Synced ${data.synced} of ${data.attempted} recent invoices`
      );
      utils.quickbooks.status.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const incomeAccounts = useMemo(
    () =>
      (accounts.data ?? []).filter((a) =>
        /Income|Other Income/i.test(a.accountType)
      ),
    [accounts.data]
  );
  const depositAccounts = useMemo(
    () =>
      (accounts.data ?? []).filter((a) =>
        /Bank|Other Current Asset|Credit Card/i.test(a.accountType)
      ),
    [accounts.data]
  );

  if (status.isLoading) {
    return (
      <div className="border-t border-border pt-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-6 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">QuickBooks Online</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          One-way sync: VetRoamer invoices and payments are pushed to QuickBooks.
          Nothing is pulled back from QuickBooks into VetRoamer.
        </p>
      </div>

      {!status.data?.configured ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Add <code className="text-xs">QUICKBOOKS_CLIENT_ID</code> and{" "}
          <code className="text-xs">QUICKBOOKS_CLIENT_SECRET</code> to your
          environment (Intuit Developer app), then redeploy.
        </p>
      ) : !status.data.connected ? (
        <Button asChild>
          <a href="/api/integrations/quickbooks/connect">
            <Link2 className="mr-2 h-4 w-4" />
            Connect QuickBooks
          </a>
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <p>
              Connected to{" "}
              <span className="font-medium">
                {status.data.companyName || "QuickBooks"}
              </span>
            </p>
            {status.data.lastSyncAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Last sync:{" "}
                {new Date(status.data.lastSyncAt).toLocaleString()}
              </p>
            )}
            {status.data.lastError && (
              <p className="text-xs text-destructive mt-1">
                Last error: {status.data.lastError}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">Income account</span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={incomeAccountId}
                onChange={(e) => setIncomeAccountId(e.target.value)}
                disabled={accounts.isLoading}
              >
                <option value="">Select income account…</option>
                {incomeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.accountType})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">
                Deposit account (optional)
              </span>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={depositAccountId}
                onChange={(e) => setDepositAccountId(e.target.value)}
                disabled={accounts.isLoading}
              >
                <option value="">Undeposited Funds / default</option>
                {depositAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.accountType})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={
                !incomeAccountId || saveMapping.isPending || accounts.isLoading
              }
              onClick={() =>
                saveMapping.mutate({
                  incomeAccountId,
                  depositAccountId: depositAccountId || null,
                })
              }
            >
              {saveMapping.isPending ? "Saving…" : "Save mapping"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={
                !status.data.incomeAccountId || syncRecent.isPending
              }
              onClick={() => syncRecent.mutate()}
            >
              {syncRecent.isPending ? "Syncing…" : "Sync recent invoices"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disconnect.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Disconnect QuickBooks? Future invoices will not sync until you reconnect."
                  )
                ) {
                  disconnect.mutate();
                }
              }}
            >
              <Unlink className="mr-1 h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
