"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfflineStatusPill } from "@/components/layout/offline-status-pill";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { APP_NAME, routeLabels, v0NewActions } from "@/lib/nav-config";

export function TopBar({
  onSearchOpen,
}: {
  onSearchOpen?: () => void;
}) {
  const pathname = usePathname();
  const basePath = "/" + (pathname.split("/")[1] ?? "");
  const label = routeLabels[basePath] ?? APP_NAME;

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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <h1 className="truncate font-heading text-base font-semibold md:text-lg">
        {label}
      </h1>

      <div className="flex items-center gap-1 md:gap-2">
        <OfflineStatusPill />
        <ThemeToggle />

        <button
          type="button"
          onClick={onSearchOpen}
          className="flex items-center gap-2 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent md:px-3"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium md:inline">
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
            <span className="hidden sm:inline">New</span>
          </Button>
          {newMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-md border border-border bg-popover shadow-md"
            >
              {v0NewActions.map(({ label: actionLabel, href, icon: Icon }) => (
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
