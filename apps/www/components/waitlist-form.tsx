"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

type Step = "interest" | "details" | "submitting" | "success" | "error";

export function WaitlistForm() {
  const [step, setStep] = useState<Step>("interest");
  const [name, setName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStep("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          practiceName: practiceName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStep("error");
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        return;
      }

      setStep("success");
    } catch {
      setStep("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  };

  if (step === "success") {
    return (
      <div className="flex items-center justify-center gap-3 py-4">
        <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
        <span className="text-teal-700 font-medium">
          You&apos;re on the list. We&apos;ll be in touch.
        </span>
      </div>
    );
  }

  if (step === "interest") {
    return (
      <button
        onClick={() => setStep("details")}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/25 hover:bg-teal-700 transition-all"
      >
        I&apos;m Interested
        <ArrowRight className="w-4 h-4" />
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto space-y-3">
      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={step === "submitting"}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60"
      />
      <input
        type="text"
        placeholder="Practice name"
        value={practiceName}
        onChange={(e) => setPracticeName(e.target.value)}
        disabled={step === "submitting"}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60"
      />
      <input
        type="email"
        required
        placeholder="you@clinic.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={step === "submitting"}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={step === "submitting"}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition-colors disabled:opacity-60"
      >
        {step === "submitting" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Joining...
          </>
        ) : (
          <>
            Join the Waitlist
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
      {step === "error" && (
        <p className="text-sm text-red-600 text-center">{errorMsg}</p>
      )}
      <p className="text-xs text-gray-400 text-center pt-1">
        No spam. Just one email when managed hosting launches.
      </p>
    </form>
  );
}
