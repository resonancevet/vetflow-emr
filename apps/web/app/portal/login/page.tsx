"use client";

import { FormEvent, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ERROR_COPY: Record<string, string> = {
  invalid: "That sign-in link is invalid. Request a new one below.",
  used: "That sign-in link was already used. Request a new one below.",
  expired: "That sign-in link has expired. Request a new one below.",
  disabled:
    "Portal access is not enabled for this account. Contact your clinic.",
  rate_limited: "Too many attempts. Please wait a bit and try again.",
};

function PortalLoginForm() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get("error");
  const errorMessage = errorKey ? ERROR_COPY[errorKey] : null;

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestLink = trpc.portal.requestMagicLink.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const statusMessage = useMemo(() => {
    if (requestLink.error) return requestLink.error.message;
    if (submitted) return requestLink.data?.message ?? null;
    return null;
  }, [requestLink.error, requestLink.data, submitted]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(false);
    requestLink.mutate({ email: email.trim() });
  };

  return (
    <div className="mx-auto max-w-md py-10">
      <h1 className="font-heading text-2xl font-semibold text-gray-900">
        Pet portal sign-in
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Enter the email on file with your veterinary clinic. We&apos;ll send a
        one-time link to open your pets&apos; portal.
      </p>

      {errorMessage && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {errorMessage}
        </p>
      )}

      {statusMessage && !requestLink.error ? (
        <div className="mt-6 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          {statusMessage}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-800">Email</span>
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          {requestLink.error && (
            <p className="text-sm text-red-600">{requestLink.error.message}</p>
          )}
          <Button
            type="submit"
            className="w-full min-h-11 bg-teal-600 hover:bg-teal-700"
            disabled={requestLink.isPending || !email.trim()}
          >
            {requestLink.isPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}

      <p className="mt-8 text-center text-xs text-gray-500">
        Prefer a permanent link from your clinic? Use the portal URL from an
        invoice or invite email.
      </p>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-gray-500">Loading…</div>
      }
    >
      <PortalLoginForm />
    </Suspense>
  );
}
