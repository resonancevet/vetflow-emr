"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Gift,
  Layers,
  Loader2,
  Package,
  DollarSign,
  ShieldAlert,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VisitPlansTab } from "@/components/catalog/visit-plans-tab";
import { InventoryKitsTab } from "@/components/settings/inventory-kits-tab";
import { ServicePackagesTab } from "@/components/settings/service-packages-tab";
import { ServicesCatalogTab } from "@/components/settings/services-catalog-tab";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Tab = "visitPlans" | "kits" | "paymentPlans" | "services";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "visitPlans", label: "Visit plans", icon: Layers },
  { id: "kits", label: "Kits", icon: Package },
  { id: "paymentPlans", label: "Payment plans", icon: Gift },
  { id: "services", label: "Services", icon: DollarSign },
];

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CatalogPageContent />
    </Suspense>
  );
}

function CatalogPageContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("visitPlans");
  const utils = trpc.useUtils();

  const migrate = trpc.templates.migrateEstimateTemplates.useMutation({
    onSuccess: (result) => {
      if (result.migrated > 0) {
        toast.success(
          `Moved ${result.migrated} estimate template${result.migrated === 1 ? "" : "s"} into Visit plans`
        );
        utils.templates.list.invalidate();
        utils.billing.listInvoices.invalidate();
      }
    },
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab as Tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (session?.user?.role === "admin" && !migrate.isPending && !migrate.isSuccess) {
      migrate.mutate();
    }
    // Run once after admin session is ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.role]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session?.user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="font-heading text-xl font-semibold">Access Denied</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only administrators can manage the catalog.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">Catalog</h2>
          <p className="text-sm text-muted-foreground">
            Kits, visit plans, payment plans, and services used to build
            estimates and invoices
          </p>
        </div>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Products &amp; inventory
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                const url = new URL(window.location.href);
                url.searchParams.set("tab", tab.id);
                window.history.replaceState({}, "", url.toString());
              }}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {activeTab === "visitPlans" && <VisitPlansTab />}
        {activeTab === "kits" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Clinical and inventory kits for vaccines and labs on the patient
              chart. They can also be expanded into visit plan line items.
            </p>
            <InventoryKitsTab />
          </div>
        )}
        {activeTab === "paymentPlans" && <ServicePackagesTab />}
        {activeTab === "services" && <ServicesCatalogTab />}
      </div>
    </div>
  );
}
