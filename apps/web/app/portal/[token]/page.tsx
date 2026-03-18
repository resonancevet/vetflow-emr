"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const speciesEmoji: Record<string, string> = {
  canine: "🐶",
  feline: "🐱",
  avian: "🐦",
  rabbit: "🐇",
  reptile: "🦎",
  equine: "🐴",
  other: "🐾",
};

function calculateAge(dob: string | null): string {
  if (!dob) return "Unknown age";
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  const months = now.getMonth() - birth.getMonth();
  const totalMonths = years * 12 + months;
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? "s" : ""} old`;
  const y = Math.floor(totalMonths / 12);
  return `${y} year${y !== 1 ? "s" : ""} old`;
}

export default function PortalHomePage() {
  const params = useParams();
  const token = params.token as string;

  const { data, isLoading, error } = trpc.portal.getClient.useQuery({ token });

  const [showApptForm, setShowApptForm] = useState(false);
  const [apptPatientId, setApptPatientId] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [apptTime, setApptTime] = useState("morning");
  const [apptReason, setApptReason] = useState("");
  const [apptSuccess, setApptSuccess] = useState("");

  const requestAppt = trpc.portal.requestAppointment.useMutation({
    onSuccess: (result) => {
      setApptSuccess(result.message);
      setShowApptForm(false);
      setApptPatientId("");
      setApptDate("");
      setApptTime("morning");
      setApptReason("");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-gray-500">
          This portal link is invalid or has expired.
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Please contact your veterinary clinic for a new link.
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {data.firstName}!
        </h1>
        <p className="text-gray-500 mt-1">
          Here is everything about your pets in one place.
        </p>
      </div>

      {/* Pet Cards */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Pets</h2>
        {data.patients.length === 0 ? (
          <p className="text-gray-400">No pets on file yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.patients.map((pet) => (
              <Link
                key={pet.id}
                href={`/portal/${token}/pets/${pet.id}`}
                className="block rounded-xl border border-gray-200 p-5 hover:border-teal-400 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-teal-50 flex items-center justify-center text-2xl flex-shrink-0">
                    {speciesEmoji[pet.species] || "🐾"}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {pet.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {pet.breed || pet.species}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {calculateAge(pet.dob)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Request Appointment */}
      <section className="mb-10">
        {apptSuccess && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm">
            {apptSuccess}
          </div>
        )}

        {!showApptForm ? (
          <button
            onClick={() => {
              setShowApptForm(true);
              setApptSuccess("");
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-300 p-4 text-teal-700 font-medium hover:bg-teal-50 hover:border-teal-400 transition-all"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Request an Appointment
          </button>
        ) : (
          <div className="rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Request an Appointment
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                requestAppt.mutate({
                  token,
                  patientId: apptPatientId,
                  preferredDate: apptDate,
                  preferredTime: apptTime,
                  reason: apptReason,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pet
                </label>
                <select
                  required
                  value={apptPatientId}
                  onChange={(e) => setApptPatientId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500"
                >
                  <option value="">Select a pet...</option>
                  {data?.patients.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name} ({pet.species})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Date
                </label>
                <input
                  type="date"
                  required
                  value={apptDate}
                  onChange={(e) => setApptDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Time
                </label>
                <select
                  value={apptTime}
                  onChange={(e) => setApptTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500"
                >
                  <option value="morning">Morning (8am - 12pm)</option>
                  <option value="afternoon">Afternoon (12pm - 5pm)</option>
                  <option value="any">Any time</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason / Notes
                </label>
                <textarea
                  required
                  value={apptReason}
                  onChange={(e) => setApptReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Annual checkup, limping on front left leg..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500"
                />
              </div>

              {requestAppt.error && (
                <p className="text-sm text-red-600">
                  {requestAppt.error.message}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={requestAppt.isPending}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {requestAppt.isPending ? "Sending..." : "Send Request"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowApptForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Links</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/portal/${token}/appointments`}
            className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 hover:border-teal-400 hover:shadow-sm transition-all"
          >
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Appointments</p>
              <p className="text-sm text-gray-500">View upcoming and past visits</p>
            </div>
          </Link>
          <Link
            href={`/portal/${token}/invoices`}
            className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 hover:border-teal-400 hover:shadow-sm transition-all"
          >
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900">Invoices</p>
              <p className="text-sm text-gray-500">View billing and payments</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
