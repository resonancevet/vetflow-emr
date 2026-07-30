"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";

export function PortalHeader() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const { data } = trpc.portal.getClient.useQuery(
    { token },
    { enabled: token.length > 0, retry: false }
  );

  const practiceName = data?.practiceName ?? "Pet Portal";
  const initial = practiceName.trim().charAt(0).toUpperCase() || "P";

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
          <span className="text-sm font-bold text-white">{initial}</span>
        </div>
        <div>
          <span className="text-sm font-semibold text-gray-900">
            {practiceName}
          </span>
          <span className="ml-1.5 text-sm font-medium text-teal-600">
            Pet Portal
          </span>
        </div>
      </div>
    </header>
  );
}
