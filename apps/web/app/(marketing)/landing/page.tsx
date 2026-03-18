"use client";

import Link from "next/link";
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
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description:
      "Day/week views, conflict detection, recurring appointments, and automated reminders.",
  },
  {
    icon: FileText,
    title: "Complete Medical Records",
    description:
      "SOAP notes, lab results, prescriptions, vaccinations, and AI scribe integration.",
  },
  {
    icon: DollarSign,
    title: "Billing & Invoicing",
    description:
      "Invoices, estimates, payment tracking, treatment templates, and online payments.",
  },
  {
    icon: PawPrint,
    title: "Patient Management",
    description:
      "Comprehensive patient profiles, weight tracking, allergy alerts, and photo uploads.",
  },
  {
    icon: Mail,
    title: "Client Communication",
    description:
      "Email and SMS reminders, client portal, discharge instructions, and vaccination alerts.",
  },
  {
    icon: Shield,
    title: "Built for Compliance",
    description:
      "Controlled substance logging, audit trails, role-based access, and data export.",
  },
];

const stats = [
  { value: "20+", label: "Modules" },
  { value: "150+", label: "API Endpoints" },
  { value: "4", label: "User Roles" },
  { value: "100%", label: "Open Source" },
];

const whyOpenSource = [
  {
    title: "Own Your Data",
    description:
      "No vendor lock-in. Export everything. Self-host or use our cloud.",
  },
  {
    title: "Save $200-600/month",
    description:
      "Commercial PIMS charge per provider per month. OpenPIMS is free forever.",
  },
  {
    title: "Built by Vets, for Vets",
    description:
      "Community-driven development informed by real veterinary workflows.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-teal-600">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold font-heading text-gray-900 tracking-tight">
                OpenPIMS
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm text-gray-600 hover:text-teal-600 transition-colors"
              >
                Features
              </a>
              <a
                href="#why-open-source"
                className="text-sm text-gray-600 hover:text-teal-600 transition-colors"
              >
                Why Open Source
              </a>
              <a
                href="/api-docs"
                className="text-sm text-gray-600 hover:text-teal-600 transition-colors"
              >
                Documentation
              </a>
              <a
                href="#"
                className="text-sm text-gray-600 hover:text-teal-600 transition-colors"
              >
                GitHub
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-700 hover:text-teal-600 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-teal-50/30" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-teal-100/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-teal-100/30 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5 mb-8">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-700">
                Free and open source forever
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading text-gray-900 tracking-tight leading-[1.1] mb-6">
              Modern Veterinary Practice Management,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-500">
                Open Source
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              The first open-source, API-first PIMS built for modern veterinary
              practices. Beautiful, fast, and free.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/25 hover:bg-teal-700 hover:shadow-teal-600/30 transition-all w-full sm:w-auto"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#"
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:border-teal-200 hover:text-teal-600 transition-all w-full sm:w-auto"
              >
                <Github className="w-5 h-5" />
                View on GitHub
              </a>
            </div>
          </div>

          {/* Hero visual element - stylized dashboard preview */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="relative rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="ml-4 text-xs text-gray-400 font-mono">
                  app.openpims.dev
                </div>
              </div>
              <div className="p-6 sm:p-8">
                <div className="grid grid-cols-12 gap-4">
                  {/* Sidebar mock */}
                  <div className="col-span-3 hidden sm:block">
                    <div className="space-y-2">
                      {[
                        "Dashboard",
                        "Schedule",
                        "Patients",
                        "Clients",
                        "Records",
                        "Billing",
                        "Inventory",
                      ].map((item, i) => (
                        <div
                          key={item}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                            i === 0
                              ? "bg-teal-50 text-teal-700 font-medium"
                              : "text-gray-500"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded ${
                              i === 0 ? "bg-teal-200" : "bg-gray-200"
                            }`}
                          />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Main content mock */}
                  <div className="col-span-12 sm:col-span-9">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <div className="h-5 w-32 bg-gray-200 rounded mb-2" />
                        <div className="h-3 w-48 bg-gray-100 rounded" />
                      </div>
                      <div className="h-9 w-28 bg-teal-600 rounded-lg" />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                      {[
                        { label: "Appointments", value: "12" },
                        { label: "Patients", value: "847" },
                        { label: "Revenue", value: "$4.2k" },
                        { label: "Pending", value: "3" },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-xl border border-gray-100 p-3 bg-gray-50/50"
                        >
                          <div className="text-xs text-gray-400 mb-1">
                            {stat.label}
                          </div>
                          <div className="text-lg font-bold text-gray-800">
                            {stat.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[1, 2, 3].map((row) => (
                        <div
                          key={row}
                          className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-teal-100 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="h-3 w-24 bg-gray-200 rounded mb-1" />
                            <div className="h-2 w-36 bg-gray-100 rounded" />
                          </div>
                          <div className="h-6 w-16 bg-teal-50 rounded-full" />
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

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gray-900 tracking-tight mb-4">
              Everything your practice needs
            </h2>
            <p className="text-lg text-gray-600">
              A complete suite of tools designed specifically for veterinary
              workflows, from scheduling to discharge.
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
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats / Social Proof Section */}
      <section className="py-20 sm:py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gray-900 tracking-tight">
              Built for real practices
            </h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="relative rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm"
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
      <section id="why-open-source" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gray-900 tracking-tight mb-4">
              Why Open Source?
            </h2>
            <p className="text-lg text-gray-600">
              We believe veterinary software should be transparent, affordable,
              and community-driven.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {whyOpenSource.map((item, index) => (
              <div key={item.title} className="relative">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-100 text-teal-700 font-bold text-lg mb-5">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold font-heading text-gray-900 mb-3">
                  {item.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 px-8 py-16 sm:px-16 sm:py-20 text-center overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-800/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight mb-4">
                Ready to modernize your practice?
              </h2>
              <p className="text-teal-100 text-lg max-w-xl mx-auto mb-8">
                Join the growing community of veterinary practices choosing
                open-source software.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-teal-700 shadow-lg hover:bg-teal-50 transition-all"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4" />
              </Link>
              <p className="mt-6 text-teal-200 text-sm">
                Or contact us at{" "}
                <a
                  href="mailto:hello@openpims.dev"
                  className="text-white underline underline-offset-2 hover:text-teal-100"
                >
                  hello@openpims.dev
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal-600">
                <Stethoscope className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold font-heading text-gray-900 tracking-tight">
                OpenPIMS
              </span>
            </div>
            <div className="flex items-center gap-8">
              <a
                href="#features"
                className="text-sm text-gray-500 hover:text-teal-600 transition-colors"
              >
                Features
              </a>
              <span className="text-sm text-gray-500">
                Pricing{" "}
                <span className="text-teal-600 font-medium">(free!)</span>
              </span>
              <a
                href="/api-docs"
                className="text-sm text-gray-500 hover:text-teal-600 transition-colors"
              >
                Documentation
              </a>
              <a
                href="#"
                className="text-sm text-gray-500 hover:text-teal-600 transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400 flex items-center gap-1">
              Built with{" "}
              <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400" /> for
              the veterinary community
            </p>
            <p className="text-sm text-gray-400">
              &copy; 2024-2026 OpenPIMS. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
