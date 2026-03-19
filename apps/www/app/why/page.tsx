import Link from "next/link";
import {
  ArrowRight,
  Github,
  Database,
  DollarSign,
  Users,
  Zap,
  Lock,
  Globe,
  Code2,
  CheckCircle2,
  Heart,
} from "lucide-react";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.openvpm.com";

export const metadata = {
  title: "Why OpenVPM — OpenVPM",
  description:
    "We got tired of hitting the same wall. So we built our own practice management system. And then we gave it away.",
};

export default function WhyPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-teal-50/30" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal-100/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5 mb-8">
            <Heart className="w-4 h-4 text-teal-600 fill-teal-200" />
            <span className="text-sm font-medium text-teal-700">Why we built this</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading text-gray-900 tracking-tight leading-[1.1] mb-8">
            We got tired of hitting the same wall.
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed">
            So we built our own practice management system. And then we gave it away.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-12 sm:py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">

          {/* Part 1: The wall */}
          <div className="space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900">
              We kept hitting a wall.
            </h2>
            <p className="text-gray-600 leading-relaxed text-lg">
              We&apos;ve been building in the veterinary space for a couple of years. Trying to bring real innovation to how practices run. AI that could take notes during an exam. A voice agent that could handle after-hours calls and actually book appointments. Tools that would genuinely reduce how much time a vet tech spends on the phone.
            </p>
            <p className="text-gray-600 leading-relaxed text-lg">
              And every time, we&apos;d hit the same wall.
            </p>
            <p className="text-gray-600 leading-relaxed text-lg">
              The software that runs your practice — the thing that holds all your patient data, your appointments, your records — it doesn&apos;t have an API. Or it has one that costs $20k/year in integration fees. Or it has one that&apos;s read-only. Or it has one that hasn&apos;t been updated since 2014.
            </p>
            <p className="text-gray-600 leading-relaxed text-lg">
              Every AI tool we tried to build eventually ran into the same question: how do we actually read and write patient data? And the answer was always: you can&apos;t. Not really.
            </p>
          </div>

          {/* Pull quote */}
          <blockquote className="border-l-4 border-teal-600 pl-6 py-2">
            <p className="text-2xl sm:text-3xl font-heading font-semibold text-gray-900 leading-snug">
              &ldquo;The software that runs your practice won&apos;t let anyone else in.&rdquo;
            </p>
          </blockquote>

          {/* Part 2: The market */}
          <div className="space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900">
              The PIMS market is genuinely broken.
            </h2>
            <p className="text-gray-600 leading-relaxed text-lg">
              When we started talking to practice owners, we heard the same things over and over. The software is clunky. The support is terrible after the contract is signed. The price keeps going up. The feature requests go nowhere. And there&apos;s almost no way to get your own data out in a useful format.
            </p>
            <p className="text-gray-600 leading-relaxed text-lg">
              A single-doctor practice is paying $300-600 per month for software that was designed in the mid-2000s and has been bolted onto ever since. Multi-location practices are paying significantly more. And in exchange, you get a system your staff complains about daily.
            </p>
            <p className="text-gray-600 leading-relaxed text-lg">
              It&apos;s not that the vendors are evil. It&apos;s that there&apos;s been no real competition. Switching costs are enormous. The data formats are proprietary. And most of the market consolidation happened in an era when &ldquo;open&rdquo; wasn&apos;t even a conversation.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { value: "$200–600+", label: "per month for a commercial PIMS", note: "for a single-location practice" },
              { value: "0", label: "open-source alternatives with a real API", note: "before OpenVPM" },
              { value: "100%", label: "of your data, yours forever", note: "export any time, any format" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-6 text-center">
                <div className="text-3xl font-bold font-heading text-teal-600 mb-1">{s.value}</div>
                <div className="text-sm font-medium text-gray-700 mb-1">{s.label}</div>
                <div className="text-xs text-gray-400">{s.note}</div>
              </div>
            ))}
          </div>

          {/* Part 3: The gap */}
          <div className="space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900">
              There was a gap nobody had filled.
            </h2>
            <p className="text-gray-600 leading-relaxed text-lg">
              Open-source practice management software exists. But the options are either deeply outdated, written for human medicine (not veterinary), or so technically complex that you need a full-time developer just to keep them running.
            </p>
            <p className="text-gray-600 leading-relaxed text-lg">
              None of them are designed to be beautiful. None of them have a documented REST API. None of them are built to be the foundation for AI tools, voice agents, or third-party integrations.
            </p>
            <p className="text-gray-600 leading-relaxed text-lg">
              There&apos;s also no data standard in veterinary medicine. There&apos;s nothing equivalent to HL7 or FHIR for the vet world. Every system stores data differently, in proprietary formats, and that means every integration requires a custom implementation. It&apos;s a mess, and nobody was fixing it.
            </p>
          </div>

          {/* Pull quote 2 */}
          <blockquote className="border-l-4 border-teal-600 pl-6 py-2">
            <p className="text-2xl sm:text-3xl font-heading font-semibold text-gray-900 leading-snug">
              &ldquo;The vet industry&apos;s open-source moment is here. We&apos;re just a little late to it.&rdquo;
            </p>
          </blockquote>

          {/* Part 4: What's different */}
          <div className="space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900">
              What&apos;s different about OpenVPM.
            </h2>
            <p className="text-gray-600 leading-relaxed text-lg">
              We didn&apos;t build OpenVPM to be &ldquo;good enough for free.&rdquo; We built it to be better than what you&apos;re paying for.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              {
                icon: Code2,
                title: "API-first from day one",
                body: "Every action in the UI goes through the same REST API that third-party tools use. 150+ endpoints. Webhooks. Scoped API keys. If the app can do it, so can your code.",
              },
              {
                icon: Globe,
                title: "Design quality that actually matters",
                body: "Staff adoption depends on software people actually want to use. We obsessed over the UI. It should feel as good as the consumer software your team uses at home.",
              },
              {
                icon: Users,
                title: "Built with the community",
                body: "The roadmap is public. Issues are open. Features are prioritized based on what practices actually need — not what a product manager predicted a year ago.",
              },
              {
                icon: Lock,
                title: "Your data, forever",
                body: "Export everything, any time. No proprietary formats. No lock-in. If you ever want to move to a different system, you can take everything with you.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-gray-100 bg-white p-6">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-600 mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold font-heading text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>
                </div>
              );
            })}
          </div>

          {/* Part 5: Where this is going */}
          <div className="space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900">
              Where this is going.
            </h2>
            <p className="text-gray-600 leading-relaxed text-lg">
              OpenVPM is a foundation. The immediate goal is to build the best open-source veterinary practice management system available — one that any clinic can run, any developer can extend, and any AI can integrate with.
            </p>
            <p className="text-gray-600 leading-relaxed text-lg">
              But the longer vision is bigger. We want OpenVPM&apos;s data schema to become the de facto open standard for veterinary health records. A common way to represent patients, records, appointments, and billing that any system can implement and any tool can consume.
            </p>
            <p className="text-gray-600 leading-relaxed text-lg">
              Imagine a future where a practice can switch systems and take all their data with them. Where an AI scribe can work with any PIMS. Where a research institution can aggregate anonymized data across systems to study disease patterns. That future starts with an open standard, and it starts here.
            </p>
          </div>

          {/* Roadmap preview */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sm:p-8">
            <h3 className="text-lg font-semibold font-heading text-gray-900 mb-5">What&apos;s coming</h3>
            <div className="space-y-4">
              {[
                { label: "Client portal", desc: "Web and mobile access for clients to view records, request appointments, and communicate with the practice", status: "In progress" },
                { label: "AI scribe integration", desc: "First-party integration for AI note-taking tools to write directly into SOAP notes via the API", status: "Planned" },
                { label: "Mobile apps", desc: "Native iOS and Android apps for veterinarians and technicians", status: "Planned" },
                { label: "OpenVPM data standard", desc: "A published schema specification for veterinary health records that any system can implement", status: "Research" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-4">
                  <div className={`mt-0.5 text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                    item.status === "In progress"
                      ? "bg-teal-100 text-teal-700"
                      : item.status === "Planned"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {item.status}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 px-8 py-16 sm:px-16 sm:py-20 text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-800/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight mb-4">
                Join us.
              </h2>
              <p className="text-teal-100 text-lg max-w-xl mx-auto mb-8">
                Try the demo, star the repo, or just reach out. We&apos;re building something the veterinary industry actually needs, and we want to build it with the community.
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
                Questions?{" "}
                <a href="mailto:hello@openvpm.com" className="text-white underline underline-offset-2 hover:text-teal-100">
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
