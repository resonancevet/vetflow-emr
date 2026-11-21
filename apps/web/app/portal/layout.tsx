import type { Metadata } from "next";
import { PortalHeader } from "@/components/portal/portal-header";

export const metadata: Metadata = {
  title: "Pet Portal",
  description: "View your pet's health information",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PortalHeader />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      <footer className="mt-12 border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center text-sm text-muted-foreground">
          Secure pet portal
        </div>
      </footer>
    </div>
  );
}
