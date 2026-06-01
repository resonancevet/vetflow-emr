"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { v0NavItems } from "@/lib/nav-config";

export function BottomNav() {
  const pathname = usePathname();
  const items = v0NavItems.filter((item) => item.mobilePrimary);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background md:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                onClick={(event) => {
                  if (typeof navigator !== "undefined" && !navigator.onLine) {
                    event.preventDefault();
                    window.location.assign(item.href);
                  }
                }}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
