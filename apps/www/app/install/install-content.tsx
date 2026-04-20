"use client";

import { useState } from "react";
import {
  ArrowRight,
  Github,
  CheckCircle2,
  Terminal,
  Cloud,
  Play,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Shield,
  Cpu,
  Zap,
} from "lucide-react";
import { CodeBlock } from "@/components/code-block";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.openvpm.com";

type TabId = "demo" | "self-host" | "cloud";

const installSteps = [
  {
    number: 1,
    title: "Clone the repo",
    code: "git clone https://github.com/evangauer/openvpm.git && cd openvpm",
    explanation: "Downloads the full codebase to your machine.",
  },
  {
    number: 2,
    title: "Copy the environment file",
    code: "cp apps/web/.env.example apps/web/.env.local",
    explanation: "Creates your local config file. The defaults work for local development.",
  },
  {
    number: 3,
    title: "Start PostgreSQL and MinIO",
    code: "docker compose up -d",
    explanation: "Spins up the database and file storage. Requires Docker Desktop.",
  },
  {
    number: 4,
    title: "Install dependencies",
    code: "pnpm install",
    explanation: "Installs all packages. Requires pnpm — run `npm i -g pnpm` if needed.",
  },
  {
    number: 5,
    title: "Push the schema and seed demo data",
    code: "pnpm db:push && pnpm db:seed",
    explanation: "Creates all database tables and loads a full set of realistic demo data.",
  },
  {
    number: 6,
    title: "Start the dev server",
    code: "pnpm dev",
    explanation: "Opens at localhost:3000. Sign in with any of the demo credentials below.",
  },
];

const demoCredentials = [
  { role: "Admin / Owner", email: "sarah.chen@pawsitivecarevet.example.com", password: "demo123", note: "Full access to all settings and reports" },
  { role: "Veterinarian", email: "james.rodriguez@pawsitivecarevet.example.com", password: "demo123", note: "Records, scheduling, prescriptions" },
  { role: "Technician", email: "emily.chen@pawsitivecarevet.example.com", password: "demo123", note: "Records, whiteboard, inventory" },
  { role: "Front Desk", email: "lisa.park@pawsitivecarevet.example.com", password: "demo123", note: "Scheduling, clients, communications" },
];

const troubleshootingItems = [
  {
    q: "Docker won't start / port already in use",
    a: "Run `docker ps` to see what's running. If PostgreSQL is already running locally, stop it first or change the port in docker-compose.yml. Default ports: 5432 (Postgres), 9000 (MinIO).",
  },
  {
    q: "pnpm not found",
    a: "Install it globally: `npm install -g pnpm`. Or use Corepack: `corepack enable && corepack prepare pnpm@latest --activate`.",
  },
  {
    q: "Environment variable errors on startup",
    a: "Open `apps/web/.env.local` and check that NEXTAUTH_URL is set to `http://localhost:3000` and NEXTAUTH_SECRET has a value. Run `openssl rand -base64 32` to generate one.",
  },
  {
    q: "Database connection refused",
    a: "Make sure Docker is running and the containers are up: `docker compose ps`. If the db container is unhealthy, try `docker compose down && docker compose up -d`.",
  },
  {
    q: "Node version errors",
    a: "OpenVPM requires Node 18+. Check with `node --version`. Use nvm to manage versions: `nvm install 20 && nvm use 20`.",
  },
];

function CredentialsTable({ showAccess = false }: { showAccess?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Password</th>
            {showAccess && (
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Access</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {demoCredentials.map((cred) => (
            <tr key={cred.role} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{cred.role}</td>
              <td className="px-4 py-3 text-gray-600 font-mono text-xs break-all">{cred.email}</td>
              <td className="px-4 py-3 text-gray-600 font-mono hidden sm:table-cell">{cred.password}</td>
              {showAccess && (
                <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">{cred.note}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InstallContent() {
  const [activeTab, setActiveTab] = useState<TabId>("demo");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const tabs: { id: TabId; label: string; icon: typeof Play }[] = [
    { id: "demo", label: "Try the Demo", icon: Play },
    { id: "self-host", label: "Self-Host", icon: Terminal },
    { id: "cloud", label: "Deploy to Cloud", icon: Cloud },
  ];

  return (
    <>
      {/* Tabs + Content */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Tab nav */}
          <div className="flex gap-2 mb-10 p-1 bg-gray-100 rounded-xl">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-teal-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[tab.label.split(" ").length - 1]}</span>
                </button>
              );
            })}
          </div>

          {/* Try the Demo */}
          {activeTab === "demo" && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 sm:p-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 mb-6">
                  <Play className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold font-heading text-gray-900 mb-3">
                  No install. No config. Just click.
                </h2>
                <p className="text-gray-600 max-w-md mx-auto mb-8 leading-relaxed">
                  The live demo runs a full instance of OpenVPM with a complete practice loaded in — patients, appointments, records, billing history. Poke around as much as you want.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                  <a
                    href={`${appUrl}/register`}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/25 hover:bg-teal-700 transition-all"
                  >
                    Open the Demo
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto text-left">
                  {[
                    { icon: Zap, text: "Instant access" },
                    { icon: CheckCircle2, text: "Full feature access" },
                    { icon: Cpu, text: "Realistic demo data" },
                  ].map((item) => {
                    const IIcon = item.icon;
                    return (
                      <div key={item.text} className="flex items-center gap-2 text-sm text-gray-600">
                        <IIcon className="w-4 h-4 text-teal-600 shrink-0" />
                        {item.text}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Demo credentials */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Demo credentials</h3>
                <CredentialsTable showAccess />
                <p className="mt-3 text-xs text-gray-400">All accounts use password: <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">demo123</code></p>
              </div>
            </div>
          )}

          {/* Self-Host */}
          {activeTab === "self-host" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-gray-800">You&apos;ll need:</span>{" "}
                  Git, Docker Desktop, Node.js 18+, and pnpm. That&apos;s it.
                </div>
              </div>

              <div className="space-y-5">
                {installSteps.map((step, i) => (
                  <div key={step.number} className="relative">
                    {i < installSteps.length - 1 && (
                      <div className="absolute left-5 bottom-0 w-px bg-gray-100" style={{ top: "2.75rem" }} />
                    )}
                    <div className="flex gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-teal-600 text-white text-sm font-bold shrink-0 z-10">
                        {step.number}
                      </div>
                      <div className="flex-1 pb-5">
                        <h3 className="text-base font-semibold text-gray-900 mb-3">{step.title}</h3>
                        <CodeBlock code={step.code} />
                        <p className="mt-2.5 text-sm text-gray-500">{step.explanation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-green-200 bg-green-50 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-green-800 mb-1">You&apos;re running.</div>
                    <p className="text-sm text-green-700">
                      Open <code className="font-mono bg-green-100 px-1.5 py-0.5 rounded">localhost:3000</code> and sign in with the demo credentials below. The full system is running locally — scheduling, records, billing, everything.
                    </p>
                  </div>
                </div>
              </div>

              {/* Demo credentials */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Sign in with these demo accounts</h3>
                <CredentialsTable />
              </div>
            </div>
          )}

          {/* Cloud Deploy */}
          {activeTab === "cloud" && (
            <div className="space-y-8">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 sm:p-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 text-white mb-6">
                  <Cloud className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold font-heading text-gray-900 mb-3">
                  Deploy to Vercel in one click.
                </h2>
                <p className="text-gray-600 max-w-md mx-auto mb-8 leading-relaxed">
                  The fastest way to get OpenVPM running in production. Vercel handles the hosting — you just need a PostgreSQL database (Neon, Supabase, or Railway all work great).
                </p>
                <a
                  href="https://vercel.com/new/clone?repository-url=https://github.com/evangauer/openvpm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-8 py-3.5 text-base font-semibold text-white hover:bg-gray-800 transition-all shadow-lg"
                >
                  Deploy to Vercel
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900">What you&apos;ll need</h3>
                {[
                  { step: "1", title: "A Vercel account", desc: "Free tier works for testing. Pro plan recommended for production." },
                  { step: "2", title: "A PostgreSQL database", desc: "Neon, Supabase, and Railway all offer free tiers. Grab the connection string." },
                  { step: "3", title: "Set your environment variables", desc: "DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, and your storage config (S3-compatible)." },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-bold shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{item.title}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
                <p>
                  <span className="font-medium text-gray-800">Need help?</span> The repo has a{" "}
                  <a
                    href="https://github.com/evangauer/openvpm"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-600 hover:underline"
                  >
                    detailed deployment guide
                  </a>{" "}
                  in the README covering environment variables, database setup, and production configuration.
                </p>
              </div>

              <div className="rounded-xl border border-teal-100 bg-teal-50/30 p-5 text-sm text-center">
                <p className="font-medium text-gray-800 mb-1">Not technical? We&apos;ll handle it.</p>
                <p className="text-gray-600">
                  We&apos;re building a managed hosting option.{" "}
                  <a href="/#waitlist" className="text-teal-600 font-medium hover:underline">
                    Join the waitlist &rarr;
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="py-16 sm:py-20 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold font-heading text-gray-900 mb-8">Troubleshooting</h2>
          <div className="space-y-2">
            {troubleshootingItems.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    <span>{item.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 ml-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-4" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-8 text-sm text-gray-500">
            Still stuck?{" "}
            <a
              href="https://github.com/evangauer/openvpm/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-600 hover:underline inline-flex items-center gap-1"
            >
              Open an issue on GitHub
              <ExternalLink className="w-3 h-3" />
            </a>{" "}
            or email us at{" "}
            <a href="mailto:hello@openvpm.com" className="text-teal-600 hover:underline">
              hello@openvpm.com
            </a>
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 px-8 py-14 sm:px-16 sm:py-16 text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-56 h-56 bg-teal-500/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white tracking-tight mb-3">
                Questions? We want to hear them.
              </h2>
              <p className="text-teal-100 max-w-lg mx-auto mb-6">
                Reach out at{" "}
                <a href="mailto:hello@openvpm.com" className="text-white underline underline-offset-2">
                  hello@openvpm.com
                </a>{" "}
                or open an issue on GitHub.
              </p>
              <a
                href="https://github.com/evangauer/openvpm"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-teal-700 shadow-md hover:bg-teal-50 transition-all"
              >
                <Github className="w-4 h-4" />
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
