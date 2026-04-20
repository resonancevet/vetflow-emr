"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, Plus, Users, PawPrint, Calendar, Receipt } from "lucide-react";
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

const NEW_ACTIONS = [
  { label: "New Client", href: "/clients/new", Icon: Users },
  { label: "New Patient", href: "/patients/new", Icon: PawPrint },
  { label: "New Appointment", href: "/schedule", Icon: Calendar },
  { label: "New Invoice", href: "/billing/new", Icon: Receipt },
];

export function TopBar({
  onSearchOpen,
}: {
  onSearchOpen?: () => void;
}) {
  const pathname = usePathname();
  const basePath = "/" + (pathname.split("/")[1] ?? "");
  const label = routeLabels[basePath] ?? "OpenVPM";

  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!newMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setNewMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [newMenuOpen]);

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

        <div className="relative" ref={newMenuRef}>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => setNewMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={newMenuOpen}
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
          {newMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-border bg-popover shadow-md"
            >
              {NEW_ACTIONS.map(({ label: actionLabel, href, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setNewMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {actionLabel}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
