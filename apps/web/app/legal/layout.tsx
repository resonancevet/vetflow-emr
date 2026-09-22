import Link from "next/link";
import { APP_NAME } from "@/lib/nav-config";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/login"
            className="font-heading text-lg font-semibold text-foreground hover:text-primary"
          >
            {APP_NAME}
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-border py-6">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
