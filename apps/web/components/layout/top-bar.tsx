"use client";

import { usePathname } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/patients": "Patients",
  "/clients": "Clients",
  "/schedule": "Schedule",
  "/records": "Records",
  "/billing": "Billing",
  "/inventory": "Inventory",
  "/inbox": "Inbox",
  "/whiteboard": "Whiteboard",
  "/reports": "Reports",
  "/settings": "Settings",
};

export function TopBar({
  onSearchOpen,
}: {
  onSearchOpen?: () => void;
}) {
  const pathname = usePathname();
  const basePath = "/" + (pathname.split("/")[1] ?? "");
  const label = routeLabels[basePath] ?? "OpenPIMS";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="font-heading text-lg font-semibold">{label}</h1>

      <div className="flex items-center gap-2">
        <button
          onClick={onSearchOpen}
          className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
        >
          <Search className="h-4 w-4" />
          <span>Search...</span>
          <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>

        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>
    </header>
  );
}
