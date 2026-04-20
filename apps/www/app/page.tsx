import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist-form";
import {
  Calendar,
  FileText,
  DollarSign,
  PawPrint,
  Mail,
  Shield,
  ArrowRight,
  Github,
  CheckCircle2,
  Stethoscope,
  Heart,
  Code2,
  Zap,
  Lock,
  Database,
  Globe,
  Cpu,
  TrendingUp,
  Users,
  Package,
  ClipboardList,
  BarChart3,
  Mic,
  Bot,
  Terminal,
  Server,
} from "lucide-react";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.openvpm.com";

const features = [
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description:
      "Day/week views with column-per-doctor layout. Drag-and-drop rescheduling, recurring appointments, automated reminders, and full status tracking from booking to checkout.",
  },
  {
    icon: FileText,
    title: "Complete Medical Records",
    description:
      "SOAP notes, lab results with reference ranges, prescriptions with refill tracking, vaccination records with certificate generation, and AI scribe integration.",
  },
  {
    icon: DollarSign,
    title: "Billing & Invoicing",
    description:
      "Charges auto-populate as services are administered. Estimates convert to invoices. Payment tracking, account balances, and end-of-day reconciliation.",
  },
  {
    icon: PawPrint,
    title: "Patient Management",
    description:
      "Comprehensive profiles with weight trend charts, allergy alerts, photo uploads, microchip tracking. Multi-pet households linked to single clients.",
  },
  {
    icon: Mail,
    title: "Client Communication",
    description:
      "Unified inbox across calls, texts, emails, and portal messages. Two-way SMS. Bulk campaigns. Every interaction logged on the client record.",
  },
  {
    icon: Shield,
    title: "Built for Compliance",
    description:
      "DEA-compliant controlled substance logging, complete audit trails, role-based access control, and full data export at any time.",
  },
  {
    icon: Package,
    title: "Inventory Management",
    description:
      "Stock levels with reorder alerts, lot/batch tracking with expiration dates. Auto-deduction when dispensed from medical records. Purchase order generation.",
  },
  {
    icon: ClipboardList,
    title: "Live Whiteboard",
    description:
      "Real-time patient status board showing every patient in the building — doctor, room, status, procedure. Updates live across all screens via WebSocket.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description:
      "Revenue trends, appointment utilization, production by doctor, species distribution, client retention. Dashboard KPIs at a glance. Export to CSV/PDF.",
  },
];

const stats = [
  { value: "21", label: "API Modules" },
  { value: "150+", label: "Endpoints" },
  { value: "16", label: "Schema Files" },
  { value: "MIT", label: "License" },
];

const painPoints = [
  {
    vendor: "ezyVet",
    quote: "Extremely nonuser friendly. Very clunky. Steep learning curve.",
    source: "Capterra reviews",
  },
  {
    vendor: "ProVet Cloud",
    quote: "Terrible financial reporting. Non-existent customer support post-implementation.",
    source: "G2 reviews",
  },
  {
    vendor: "Legacy Systems",
    quote: "Click-heavy interfaces, system crashes, and no cloud access.",
    source: "Industry analysis",
  },
];

const aiUseCases = [
  {
    icon: Mic,
    title: "Voice Agents",
    description: "Book appointments, process refill requests, and complete intake forms over the phone",
  },
  {
    icon: Bot,
    title: "AI Scribes",
    description: "Write SOAP notes directly into the medical record from conversation transcripts",
  },
  {
    icon: Cpu,
    title: "Diagnostic AI",
    description: "Read lab results, patient history, and write differential diagnosis suggestions",
  },
  {
    icon: TrendingUp,
    title: "Proactive Outreach",
    description: "Query overdue vaccinations and pending follow-ups to automate client communications",
  },
];

const howItWorksSteps = [
  {
    number: "01",
    icon: Terminal,
    title: "Clone & configure",
    description: "Two commands — clone the repo and copy the environment file. Done.",
  },
  {
    number: "02",
    icon: Server,
    title: "Start the stack",
    description: "Docker brings up PostgreSQL and MinIO. No installs, no config files to wrestle.",
  },
  {
    number: "03",
    icon: Stethoscope,
    title: "You're live",
    description: "Seed demo data, open your browser, and you're running a full practice management system.",
  },
];

export const metadata: Metadata = {
  title: "OpenVPM — Open-Source Veterinary Practice Management",
  description:
    "The first modern, API-first practice management system built for the veterinary community. Beautiful, fast, free, and open source.",
};

export default function LandingPage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-teal-50/30" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-teal-100/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-teal-100/30 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5 mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500"
            >
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-700">
                Free and open source &mdash; MIT licensed, forever
              </span>
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading text-gray-900 tracking-tight leading-[1.1] mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: "100ms" }}
            >
              The veterinary industry&apos;s{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-500">
                open-source moment
              </span>{" "}
              is here.
            </h1>
            <p
              className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: "200ms" }}
            >
              OpenVPM is the first modern, API-first practice management system built
              for the veterinary community. Beautiful. Fast. Free.
              And the AI platform the industry needs.
            </p>
            <div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
              style={{ animationDelay: "300ms" }}
            >
              <a
                href={`${appUrl}/register`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/25 hover:bg-teal-700 hover:shadow-teal-600/30 transition-all w-full sm:w-auto"
              >
                Try the Live Demo
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="https://github.com/evangauer/openvpm"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:border-teal-200 hover:text-teal-600 transition-all w-full sm:w-auto"
              >
                <Github className="w-5 h-5" />
                View on GitHub
              </a>
            </div>
          </div>

          {/* Hero visual — stylized dashboard preview */}
          <div
            className="mt-16 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700"
            style={{ animationDelay: "400ms" }}
          >
            <div className="relative rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="ml-4 text-xs text-gray-400 font-mono">
                  openvpm.com
                </div>
              </div>
              <div className="p-6 sm:p-8">
                <div className="grid grid-cols-12 gap-4">
                  {/* Sidebar mock */}
                  <div className="col-span-3 hidden sm:block">
                    <div className="space-y-1">
                      {[
                        { name: "Dashboard", active: true },
                        { name: "Schedule", active: false },
                        { name: "Patients", active: false },
                        { name: "Clients", active: false },
                        { name: "Records", active: false },
                        { name: "Billing", active: false },
                        { name: "Inventory", active: false },
                        { name: "Inbox", active: false },
                        { name: "Whiteboard", active: false },
                        { name: "Reports", active: false },
                      ].map((item) => (
                        <div
                          key={item.name}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                            item.active
                              ? "bg-teal-50 text-teal-700 font-medium"
                              : "text-gray-400"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded ${
                              item.active ? "bg-teal-200" : "bg-gray-100"
                            }`}
                          />
                          {item.name}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Main content mock */}
                  <div className="col-span-12 sm:col-span-9">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <div className="text-lg font-semibold text-gray-800 mb-1">Good morning, Dr. Chen</div>
                        <div className="text-sm text-gray-400">Pawsitive Care Veterinary &middot; Wednesday, March 18</div>
                      </div>
                      <div className="h-9 w-28 bg-teal-600 rounded-lg flex items-center justify-center text-xs text-white font-medium">
                        + New Appt
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                      {[
                        { label: "Today's Appts", value: "14", color: "text-teal-600" },
                        { label: "Patients Seen", value: "8", color: "text-blue-600" },
                        { label: "Revenue (MTD)", value: "$22.1k", color: "text-emerald-600" },
                        { label: "Pending Invoices", value: "5", color: "text-amber-600" },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-xl border border-gray-100 p-3 bg-gray-50/50"
                        >
                          <div className="text-xs text-gray-400 mb-1">
                            {stat.label}
                          </div>
                          <div className={`text-xl font-bold ${stat.color}`}>
                            {stat.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Upcoming</div>
                    <div className="space-y-2">
                      {[
                        { time: "9:00 AM", patient: "Luna (Labrador Mix)", owner: "Marcus J.", type: "Wellness Exam", status: "Checked In", statusColor: "bg-blue-100 text-blue-700" },
                        { time: "9:30 AM", patient: "Oliver (Maine Coon)", owner: "Sarah K.", type: "Vaccination", status: "Scheduled", statusColor: "bg-gray-100 text-gray-600" },
                        { time: "10:15 AM", patient: "Cooper (Beagle)", owner: "Olivia B.", type: "Dental Cleaning", status: "Confirmed", statusColor: "bg-green-100 text-green-700" },
                        { time: "11:00 AM", patient: "Mochi (Shih Tzu)", owner: "Kevin T.", type: "Follow-up", status: "Confirmed", statusColor: "bg-green-100 text-green-700" },
                      ].map((appt) => (
                        <div
                          key={appt.time}
                          className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
                        >
                          <div className="text-xs text-gray-400 font-mono w-16 shrink-0">{appt.time}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800">{appt.patient}</div>
                            <div className="text-xs text-gray-400">{appt.type} &middot; {appt.owner}</div>
                          </div>
                          <div className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${appt.statusColor}`}>
                            {appt.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 sm:py-20 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900 tracking-tight mb-3">
              Up and running in minutes.
            </h2>
            <p className="text-gray-600">
              No SaaS salesperson. No 6-week onboarding. Just you, a terminal, and a running practice management system.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {howItWorksSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="relative text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 mb-5 relative">
                    <Icon className="w-7 h-7" />
                    <span className="absolute -top-2 -right-2 text-xs font-bold font-heading text-teal-600 bg-teal-100 rounded-full w-5 h-5 flex items-center justify-center">
                      {step.number.replace("0", "")}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold font-heading text-gray-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/install"
              className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
            >
              Full install guide
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-20 sm:py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gray-900 tracking-tight mb-4">
              The PIMS market is broken.
              <br />
              <span className="text-gray-400">Everyone knows it.</span>
            </h2>
            <p className="text-lg text-gray-600">
              Commercial systems charge $200&ndash;600+/month, lock you into proprietary
              data formats, and deliver software that frustrates your team daily.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {painPoints.map((point) => (
              <div
                key={point.vendor}
                className="rounded-2xl border border-red-100 bg-red-50/50 p-6"
              >
                <div className="text-sm font-semibold text-red-800 mb-3">{point.vendor}</div>
                <p className="text-red-700 text-sm leading-relaxed italic mb-3">
                  &ldquo;{point.quote}&rdquo;
                </p>
                <p className="text-xs text-red-400">&mdash; {point.source}</p>
              </div>
            ))}
          </div>
          <div className="max-w-2xl mx-auto mt-12 text-center">
            <p className="text-gray-500 text-base">
              Meanwhile, AI is arriving and most PIMS have closed APIs that make it impossible for
              AI tools to read or write patient data. There is no widely adopted data interoperability
              standard in veterinary medicine.
            </p>
            <p className="text-gray-900 font-semibold text-lg mt-4">
              Until now.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gray-900 tracking-tight mb-4">
              Everything your practice needs.
              <br />
              Nothing you don&apos;t.
            </h2>
            <p className="text-lg text-gray-600">
              A complete suite of tools designed for real veterinary workflows &mdash;
              from the moment a client calls to the moment they walk out the door.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group relative rounded-2xl border border-gray-100 bg-white p-6 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-50 transition-all duration-300"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-50 text-teal-600 mb-5 group-hover:bg-teal-100 transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold font-heading text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/features"
              className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
            >
              See every feature in detail
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Open API & AI Section */}
      <section id="api" className="py-20 sm:py-28 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 mb-6">
                <Code2 className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                  The Killer Feature
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gray-900 tracking-tight mb-4">
                A real, open API.
                <br />
                <span className="text-teal-600">The first of its kind.</span>
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Every action the UI performs goes through the same API available to
                third-party integrations. 150+ endpoints with full documentation,
                webhook subscriptions, scoped API keys, and rate limiting.
              </p>
              <p className="text-base text-gray-500 mb-8">
                No other open-source veterinary PIMS has a documented, read-write API.
                This is what makes OpenVPM the platform the industry can build on.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Zap, label: "Webhooks for real-time events" },
                  { icon: Lock, label: "HMAC-SHA256 signed payloads" },
                  { icon: Database, label: "Structured, queryable data" },
                  { icon: Globe, label: "REST + WebSocket" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-start gap-2">
                      <Icon className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-600">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Code preview */}
            <div className="rounded-2xl border border-gray-200 bg-gray-950 overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                <div className="w-3 h-3 rounded-full bg-gray-700" />
                <div className="w-3 h-3 rounded-full bg-gray-700" />
                <div className="w-3 h-3 rounded-full bg-gray-700" />
                <span className="ml-3 text-xs text-gray-500 font-mono">webhook payload</span>
              </div>
              <pre className="p-6 text-sm text-gray-300 font-mono overflow-x-auto leading-relaxed">
{`{
  "event": "appointment.checked_in",
  "timestamp": "2026-03-18T09:02:14Z",
  "data": {
    "appointment_id": "apt_7f3k9...",
    "patient": {
      "name": "Luna",
      "species": "canine",
      "breed": "Labrador Mix"
    },
    "client": {
      "name": "Marcus Johnson",
      "phone": "+1-503-555-2002"
    },
    "doctor": "Dr. Sarah Chen",
    "type": "Wellness Exam",
    "room": "Exam Room 1"
  }
}`}
              </pre>
            </div>
          </div>

          {/* AI Use Cases */}
          <div className="mt-20">
            <div className="text-center mb-12">
              <h3 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900 mb-3">
                Built for the AI era
              </h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                OpenVPM&apos;s structured data and open API make it the ideal foundation for
                veterinary AI. The PIMS is the system of record. AI agents are first-class citizens.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {aiUseCases.map((useCase) => {
                const Icon = useCase.icon;
                return (
                  <div key={useCase.title} className="rounded-xl border border-gray-100 bg-white p-5">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-900 text-white mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">{useCase.title}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{useCase.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="relative rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-8 text-center"
              >
                <div className="text-4xl sm:text-5xl font-bold font-heading text-teal-600 mb-2">
                  {stat.value}
                </div>
                <div className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Open Source Section */}
      <section id="why-open-source" className="py-20 sm:py-28 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gray-900 tracking-tight mb-4">
              Why open source matters for veterinary medicine
            </h2>
            <p className="text-lg text-gray-600">
              The veterinary industry is at a crossroads. AI is arriving. Data interoperability
              is becoming critical. And the dominant vendors are still charging hundreds per month
              for software that crashes, frustrates staff, and locks clinics into proprietary ecosystems.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                title: "Own Your Data",
                description: "Export everything, any time. No lock-in, no proprietary formats. Your practice data belongs to you, period.",
                icon: Database,
              },
              {
                title: "Zero Software Cost",
                description: "Invest the $200\u2013600/month you were paying for a commercial PIMS back into your team instead.",
                icon: DollarSign,
              },
              {
                title: "Community Roadmap",
                description: "Features are built because practices need them, not because a sales team prioritized them for a quarterly target.",
                icon: Users,
              },
              {
                title: "Innovation Platform",
                description: "An open API means the next generation of veterinary AI tools can be built on a foundation that actually works.",
                icon: Zap,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="relative">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-50 text-teal-600 mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold font-heading text-gray-900 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-12">
            <Link
              href="/why"
              className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors"
            >
              Read the full story
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Quote / Testimonial */}
      <section className="py-16 sm:py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-medium text-teal-600 uppercase tracking-wider mb-4">What practice owners told us</p>
          <blockquote className="text-2xl sm:text-3xl font-heading font-semibold text-gray-900 leading-snug mb-6">
            &ldquo;Show me software that actually reduces our staff hours. That&apos;s the only thing that matters.&rdquo;
          </blockquote>
          <div className="text-gray-500">
            <span className="font-medium text-gray-700">A practice manager</span>
            {" "}&mdash; from our early research interviews
          </div>
          <p className="mt-4 text-gray-400 text-sm max-w-xl mx-auto">
            That&apos;s exactly what we&apos;re building. OpenVPM is designed from the ground up
            to make every team member faster &mdash; from the front desk to the exam room.
          </p>
        </div>
      </section>

      {/* Managed Hosting Waitlist */}
      <section id="waitlist" className="py-16 sm:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-teal-100 bg-teal-50/30 p-8 sm:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900 tracking-tight mb-4">
              Don&apos;t want to self-host?
            </h2>
            <p className="text-gray-600 max-w-lg mx-auto mb-8 leading-relaxed">
              We&apos;re working on managed hosting so your practice can use OpenVPM
              for a fraction of what you&apos;re paying today &mdash; no terminal, no devops, just software that works.
            </p>

            <WaitlistForm />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 max-w-lg mx-auto text-left">
              {[
                "Full data transfer",
                "Managed hosting",
                "Fully secure",
                "You own your data",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-xs text-gray-600">{item}</span>
                </div>
              ))}
            </div>

            <p className="mt-8 text-xs text-gray-400">
              Built by the team at{" "}
              <a
                href="https://gettalky.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-teal-600 underline underline-offset-2"
              >
                Get Talky
              </a>
              {" "}&mdash; we&apos;ve been building AI tools for veterinary practices since 2023.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 px-8 py-16 sm:px-16 sm:py-20 text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-800/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight mb-4">
                The future of veterinary software is open.
              </h2>
              <p className="text-teal-100 text-lg max-w-xl mx-auto mb-8">
                Join us in building practice management software that&apos;s built
                with the veterinary community, not sold to it.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href={`${appUrl}/register`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-teal-700 shadow-lg hover:bg-teal-50 transition-all"
                >
                  Try the Live Demo
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="https://github.com/evangauer/openvpm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-teal-400 px-8 py-3.5 text-base font-semibold text-white hover:bg-teal-600 transition-all"
                >
                  <Github className="w-5 h-5" />
                  Star on GitHub
                </a>
              </div>
              <p className="mt-8 text-teal-200 text-sm">
                Questions? Reach out at{" "}
                <a
                  href="mailto:hello@openvpm.com"
                  className="text-white underline underline-offset-2 hover:text-teal-100"
                >
                  hello@openvpm.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
