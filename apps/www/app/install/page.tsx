import { Clock } from "lucide-react";
import { InstallContent } from "./install-content";

export const metadata = {
  title: "Install — OpenVPM",
  description:
    "Three ways to start. Try the live demo right now, self-host with Docker, or deploy to Vercel in one click.",
};

export default function InstallPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-teal-50/30" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal-100/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5 mb-6">
            <Clock className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-700">Up and running in 5 minutes</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading text-gray-900 tracking-tight leading-[1.1] mb-6">
            Let&apos;s get this going.
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Three ways to start. Try the live demo right now, self-host with Docker, or deploy to Vercel in one click.
          </p>
        </div>
      </section>

      <InstallContent />
    </div>
  );
}
