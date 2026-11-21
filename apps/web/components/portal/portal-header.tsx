"use client";

import { useParams, usePathname } from "next/navigation";
import { PawPrint } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { trpc } from "@/lib/trpc";

const DEFAULT_PRACTICE_NAME = "Roma Veterinary Care, PLLC";

export function PortalHeader() {
  const params = useParams();
  const pathname = usePathname();
  const token = typeof params.token === "string" ? params.token : "";
  const isIntake = pathname?.includes("/portal/intake/") ?? false;

  const clientQuery = trpc.portal.getClient.useQuery(
    { token },
    { enabled: !isIntake && token.length > 0, retry: false }
  );

  const practiceName = isIntake
    ? DEFAULT_PRACTICE_NAME
    : clientQuery.data?.practiceName || DEFAULT_PRACTICE_NAME;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
          <PawPrint className="h-4 w-4 text-white" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-foreground">
            {practiceName}
          </span>
          <span className="ml-1.5 text-sm font-medium text-teal-600 dark:text-teal-400">
            Pet Portal
          </span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
