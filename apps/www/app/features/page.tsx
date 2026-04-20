import Link from "next/link";
import {
  Calendar,
  FileText,
  DollarSign,
  PawPrint,
  Mail,
  Shield,
  Package,
  ClipboardList,
  BarChart3,
  ArrowRight,
  Github,
  CheckCircle2,
  Code2,
  Zap,
  Lock,
  Database,
  Globe,
  Users,
  Clock,
  Repeat,
  Bell,
  TrendingUp,
  Stethoscope,
  FlaskConical,
  Pill,
  Receipt,
  CreditCard,
  Weight,
  Camera,
  Cpu,
  MessageSquare,
  Phone,
  Send,
  AlertCircle,
  Activity,
  FileBarChart,
} from "lucide-react";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://demo.openvpm.com";

const modules = [
  {
    id: "schedule",
    icon: Calendar,
    title: "Smart Scheduling",
    description:
      "Your front desk moves fast. The schedule needs to keep up. OpenVPM's scheduling gives you a real-time view of every appointment, every doctor, every room — and lets you move things around without breaking a sweat.",
    bullets: [
      { icon: Clock, text: "Day and week views with one column per doctor" },
      { icon: Repeat, text: "Recurring appointments with custom recurrence rules" },
      { icon: Bell, text: "Automated reminders via SMS and email" },
      { icon: CheckCircle2, text: "Full status tracking: scheduled → confirmed → checked in → in exam → ready for checkout" },
    ],
    mockup: (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-xs font-medium text-gray-700">Wednesday, March 18</div>
          <div className="ml-auto flex gap-2">
            {["Dr. Chen", "Dr. Rodriguez"].map((doc) => (
              <div key={doc} className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-full font-medium">{doc}</div>
            ))}
          </div>
        </div>
        {[
          { time: "9:00", patient: "Luna", type: "Wellness", status: "Checked In", color: "bg-blue-100 text-blue-700" },
          { time: "9:30", patient: "Oliver", type: "Vaccination", status: "Scheduled", color: "bg-gray-100 text-gray-600" },
          { time: "10:15", patient: "Cooper", type: "Dental", status: "Confirmed", color: "bg-green-100 text-green-700" },
          { time: "11:00", patient: "Mochi", type: "Follow-up", status: "In Exam", color: "bg-purple-100 text-purple-700" },
        ].map((a) => (
          <div key={a.time} className="flex items-center gap-3 rounded-lg bg-white border border-gray-100 p-2.5">
            <div className="text-xs font-mono text-gray-400 w-10 shrink-0">{a.time}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-800">{a.patient}</div>
              <div className="text-xs text-gray-400">{a.type}</div>
            </div>
            <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.color}`}>{a.status}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "records",
    icon: FileText,
    title: "Medical Records",
    description:
      "Everything that happens in the exam room, captured where it belongs. SOAP notes, labs, prescriptions, vaccines — all connected to the patient record and accessible from anywhere.",
    bullets: [
      { icon: Stethoscope, text: "Structured SOAP notes with templates" },
      { icon: FlaskConical, text: "Lab results with species-specific reference ranges" },
      { icon: Pill, text: "Prescriptions with refill tracking and DEA logging" },
      { icon: CheckCircle2, text: "Vaccination records with auto-generated certificates" },
    ],
    mockup: (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center">
            <PawPrint className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-800">Luna — Labrador Mix, 3yr F</div>
            <div className="text-xs text-gray-400">Marcus Johnson &middot; Wellness Exam</div>
          </div>
        </div>
        {[
          { label: "S", content: "Owner reports patient has been lethargic for 2 days. Eating normally." },
          { label: "O", content: "T: 101.8°F, HR: 84bpm, RR: 18. Mild lymphadenopathy noted." },
          { label: "A", content: "Mild lymphadenopathy — likely reactive. CBC ordered." },
          { label: "P", content: "CBC/Chemistry panel. Recheck in 7 days if no improvement." },
        ].map((s) => (
          <div key={s.label} className="flex gap-2">
            <div className="w-5 h-5 rounded bg-teal-600 text-white text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">{s.label}</div>
            <p className="text-xs text-gray-600 leading-relaxed">{s.content}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "billing",
    icon: DollarSign,
    title: "Billing & Invoicing",
    description:
      "Billing shouldn't be an afterthought. As services are administered, charges populate automatically. Estimates convert to invoices in one click. End-of-day reconciliation takes two minutes.",
    bullets: [
      { icon: Receipt, text: "Charges auto-added as services are administered" },
      { icon: FileText, text: "Estimates convert to invoices with one click" },
      { icon: CreditCard, text: "Payment tracking with account balance history" },
      { icon: BarChart3, text: "End-of-day reconciliation reports" },
    ],
    mockup: (
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-700 mb-3">Invoice #INV-2847</div>
        {[
          { item: "Wellness Exam", qty: 1, price: "$65.00" },
          { item: "DHPP Vaccination", qty: 1, price: "$38.00" },
          { item: "Heartworm Test", qty: 1, price: "$42.00" },
          { item: "Flea Prevention (3mo)", qty: 1, price: "$54.00" },
        ].map((line) => (
          <div key={line.item} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">
            <span className="text-gray-700">{line.item}</span>
            <span className="font-medium text-gray-900">{line.price}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-sm font-semibold text-gray-900 pt-2">
          <span>Total</span>
          <span className="text-teal-600">$199.00</span>
        </div>
        <div className="mt-3 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-xs text-white font-medium">
          Process Payment
        </div>
      </div>
    ),
  },
  {
    id: "patients",
    icon: PawPrint,
    title: "Patient Management",
    description:
      "Every patient gets a complete profile. Weight history plotted on a chart. Allergy alerts that actually show up when you need them. Photos, microchip numbers, multi-pet households — it's all there.",
    bullets: [
      { icon: Weight, text: "Weight trend charts with breed-appropriate overlays" },
      { icon: AlertCircle, text: "Allergy alerts visible throughout the record" },
      { icon: Camera, text: "Photo uploads and microchip tracking" },
      { icon: Users, text: "Multi-pet households linked to a single client" },
    ],
    mockup: (
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <PawPrint className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">Luna</div>
            <div className="text-xs text-gray-500">Labrador Mix &middot; 3yr &middot; F (Spayed)</div>
            <div className="text-xs text-gray-400">DOB: Mar 2023 &middot; Microchip: 985112006543210</div>
          </div>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
          <div className="text-xs font-semibold text-red-700 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Allergies
          </div>
          <div className="text-xs text-red-600 mt-0.5">Penicillin, Sulfonamides</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[{ label: "Weight", val: "28.4 kg" }, { label: "Last Visit", val: "Mar 18" }, { label: "Visits", val: "12" }].map((s) => (
            <div key={s.label} className="rounded-lg bg-gray-50 p-2">
              <div className="text-xs font-semibold text-gray-800">{s.val}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "communications",
    icon: Mail,
    title: "Client Communications",
    description:
      "Every message to every client, in one place. Two-way SMS, email, portal messages, and phone notes all live on the client record. No more sticky notes or checking three different apps.",
    bullets: [
      { icon: MessageSquare, text: "Unified inbox: SMS, email, and portal messages" },
      { icon: Phone, text: "Two-way SMS with automated appointment reminders" },
      { icon: Send, text: "Bulk campaigns for recalls and announcements" },
      { icon: FileText, text: "Every interaction logged on the client record" },
    ],
    mockup: (
      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-500 mb-2">Inbox</div>
        {[
          { name: "Marcus Johnson", msg: "Hi, is Luna due for any boosters?", time: "2m ago", unread: true },
          { name: "Sarah Kim", msg: "Oliver's prescription is ready for pickup", time: "1h ago", unread: false },
          { name: "Olivia Bennett", msg: "Cooper's bloodwork results — any concerns?", time: "3h ago", unread: true },
          { name: "Kevin Tanaka", msg: "Can we move tomorrow's appointment to 2pm?", time: "Yesterday", unread: false },
        ].map((m) => (
          <div key={m.name} className={`flex items-start gap-2.5 rounded-lg p-2.5 ${m.unread ? "bg-teal-50/50" : "bg-white"}`}>
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
              {m.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className={`text-xs font-medium ${m.unread ? "text-gray-900" : "text-gray-600"}`}>{m.name}</div>
                <div className="text-xs text-gray-400">{m.time}</div>
              </div>
              <div className="text-xs text-gray-500 truncate">{m.msg}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "inventory",
    icon: Package,
    title: "Inventory Management",
    description:
      "Stock levels, reorder points, lot tracking, expiration dates. When a prescription is dispensed from the medical record, inventory updates automatically. No manual counts needed.",
    bullets: [
      { icon: AlertCircle, text: "Low stock alerts with configurable reorder points" },
      { icon: Shield, text: "Lot/batch tracking with expiration date monitoring" },
      { icon: Repeat, text: "Auto-deduction when items are dispensed from records" },
      { icon: FileText, text: "Purchase order generation for restocking" },
    ],
    mockup: (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-gray-700">Current Stock</div>
          <div className="text-xs text-amber-600 font-medium">3 items low</div>
        </div>
        {[
          { name: "Rimadyl 100mg", stock: 48, unit: "tablets", status: "ok" },
          { name: "Heartgard Plus (51-100 lbs)", stock: 6, unit: "doses", status: "low" },
          { name: "Doxycycline 100mg", stock: 120, unit: "capsules", status: "ok" },
          { name: "Convenia 80mg/mL", stock: 2, unit: "vials", status: "critical" },
        ].map((item) => (
          <div key={item.name} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2.5">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-800 truncate">{item.name}</div>
              <div className="text-xs text-gray-400">{item.stock} {item.unit}</div>
            </div>
            <div className={`w-2 h-2 rounded-full shrink-0 ${item.status === "ok" ? "bg-green-400" : item.status === "low" ? "bg-amber-400" : "bg-red-400"}`} />
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "whiteboard",
    icon: ClipboardList,
    title: "Live Whiteboard",
    description:
      "Every patient in the building, on one screen. The whiteboard shows doctor, room, status, and current procedure in real time — and updates live via WebSocket across every screen in the clinic.",
    bullets: [
      { icon: Activity, text: "Real-time updates via WebSocket — no refresh needed" },
      { icon: Users, text: "One row per patient, sorted by arrival time" },
      { icon: CheckCircle2, text: "One-click status transitions from any screen" },
      { icon: Globe, text: "Works on TVs, tablets, and desktop browsers" },
    ],
    mockup: (
      <div className="space-y-1.5">
        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-gray-400 uppercase tracking-wider pb-1.5 border-b border-gray-100">
          <div>Patient</div>
          <div>Doctor</div>
          <div>Room</div>
          <div>Status</div>
        </div>
        {[
          { patient: "Luna", doctor: "Dr. Chen", room: "Exam 1", status: "In Exam", color: "bg-purple-100 text-purple-700" },
          { patient: "Oliver", doctor: "Dr. Rodriguez", room: "Exam 3", status: "Checked In", color: "bg-blue-100 text-blue-700" },
          { patient: "Cooper", doctor: "Dr. Chen", room: "Surgery", status: "In Procedure", color: "bg-orange-100 text-orange-700" },
          { patient: "Mochi", doctor: "—", room: "Lobby", status: "Waiting", color: "bg-gray-100 text-gray-600" },
        ].map((row) => (
          <div key={row.patient} className="grid grid-cols-4 gap-2 text-xs py-1.5 items-center">
            <div className="font-medium text-gray-800">{row.patient}</div>
            <div className="text-gray-500">{row.doctor}</div>
            <div className="text-gray-500">{row.room}</div>
            <div className={`px-1.5 py-0.5 rounded text-center ${row.color}`}>{row.status}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "compliance",
    icon: Shield,
    title: "Built for Compliance",
    description:
      "Veterinary practices handle controlled substances, sensitive client data, and regulated medical records. OpenVPM gives you the audit trail and access controls to stay compliant without slowing your team down.",
    bullets: [
      { icon: Lock, text: "DEA-compliant controlled substance logging with full chain of custody" },
      { icon: FileText, text: "Complete audit trails — every record change tracked with who, what, and when" },
      { icon: Users, text: "Role-based access control with granular permission sets" },
      { icon: Database, text: "Full data export at any time — CSV, JSON, or PDF" },
    ],
    mockup: (
      <div className="space-y-3">
        <div className="text-xs font-medium text-gray-700 mb-2">Audit Log</div>
        {[
          { user: "Dr. Chen", action: "Updated SOAP note", record: "Luna — Wellness Exam", time: "2m ago" },
          { user: "Emily C.", action: "Dispensed Rimadyl 100mg (x14)", record: "Cooper — Post-Op", time: "18m ago" },
          { user: "Lisa P.", action: "Modified appointment", record: "Oliver — Vaccination", time: "45m ago" },
          { user: "Dr. Rodriguez", action: "Signed prescription", record: "Mochi — Antibiotics", time: "1h ago" },
        ].map((entry) => (
          <div key={entry.time} className="flex items-start gap-2.5 rounded-lg border border-gray-100 p-2.5">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600 shrink-0">
              {entry.user[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-800">{entry.action}</div>
              <div className="text-xs text-gray-400">{entry.record}</div>
            </div>
            <div className="text-xs text-gray-400 shrink-0">{entry.time}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Reports & Analytics",
    description:
      "Know how your practice is doing without running numbers in a spreadsheet. Revenue trends, doctor production, appointment utilization, client retention — all built in and ready to export.",
    bullets: [
      { icon: TrendingUp, text: "Revenue trends with month-over-month comparison" },
      { icon: Users, text: "Production reports by doctor and department" },
      { icon: Calendar, text: "Appointment utilization and no-show tracking" },
      { icon: FileBarChart, text: "Export to CSV or PDF for any report" },
    ],
    mockup: (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Revenue (MTD)", value: "$22,140", change: "+12%", up: true },
            { label: "Appointments", value: "187", change: "+8%", up: true },
            { label: "Avg Invoice", value: "$118", change: "-2%", up: false },
            { label: "New Clients", value: "23", change: "+18%", up: true },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-gray-50 p-2.5">
              <div className="text-xs text-gray-400">{s.label}</div>
              <div className="text-sm font-bold text-gray-800">{s.value}</div>
              <div className={`text-xs font-medium ${s.up ? "text-green-600" : "text-red-500"}`}>{s.change} vs last month</div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-gray-50 p-2.5">
          <div className="text-xs text-gray-500 mb-2">Doctor Production — March 2026</div>
          {[{ name: "Dr. Chen", pct: 58, val: "$12,841" }, { name: "Dr. Rodriguez", pct: 42, val: "$9,299" }].map((d) => (
            <div key={d.name} className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-700">{d.name}</span>
                <span className="font-medium text-gray-900">{d.val}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200">
                <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${d.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export default function FeaturesPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-teal-50/30" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-teal-100/40 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5 mb-6">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-700">9 modules. Every workflow covered.</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading text-gray-900 tracking-tight leading-[1.1] mb-6">
            Everything your practice needs.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-500">
              And an API for all of it.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Built for real veterinary workflows — scheduling, records, billing, inventory, and more.
            Every module works together. Every module has an API.
          </p>
        </div>
      </section>

      {/* Module sections */}
      <section className="py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            const isEven = i % 2 === 0;
            return (
              <div
                key={mod.id}
                id={mod.id}
                className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
                  !isEven ? "lg:grid-flow-dense" : ""
                }`}
              >
                {/* Text */}
                <div className={!isEven ? "lg:col-start-2" : ""}>
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-teal-50 text-teal-600 mb-6">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold font-heading text-gray-900 tracking-tight mb-4">
                    {mod.title}
                  </h2>
                  <p className="text-gray-600 leading-relaxed mb-8">
                    {mod.description}
                  </p>
                  <ul className="space-y-3">
                    {mod.bullets.map((b) => {
                      const BIcon = b.icon;
                      return (
                        <li key={b.text} className="flex items-start gap-3">
                          <BIcon className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                          <span className="text-sm text-gray-700">{b.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Mockup */}
                <div className={!isEven ? "lg:col-start-1 lg:row-start-1" : ""}>
                  <div className="rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-100/80 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                      <div className="ml-3 text-xs text-gray-400 font-mono">openvpm.com/{mod.id}</div>
                    </div>
                    <div className="p-5 bg-gray-50/30">
                      {mod.mockup}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* API Section */}
      <section className="py-20 sm:py-28 bg-gradient-to-b from-gray-50 to-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 mb-6">
                <Code2 className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">
                  Every feature has an API
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold font-heading text-gray-900 tracking-tight mb-4">
                Build anything on top of it.
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Every action in the UI — booking an appointment, writing a SOAP note, processing a payment — goes through the same REST API available to third-party integrations.
              </p>
              <p className="text-base text-gray-500 mb-8">
                150+ endpoints. Webhook subscriptions for real-time events. Scoped API keys. Full documentation. This is what makes OpenVPM the platform the industry can build on.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Zap, label: "Webhooks for real-time events" },
                  { icon: Lock, label: "HMAC-SHA256 signed payloads" },
                  { icon: Database, label: "Structured, queryable data" },
                  { icon: Globe, label: "REST + WebSocket" },
                ].map((item) => {
                  const IIcon = item.icon;
                  return (
                    <div key={item.label} className="flex items-start gap-2">
                      <IIcon className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                      <span className="text-sm text-gray-600">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-950 overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                <div className="w-3 h-3 rounded-full bg-gray-700" />
                <div className="w-3 h-3 rounded-full bg-gray-700" />
                <div className="w-3 h-3 rounded-full bg-gray-700" />
                <span className="ml-3 text-xs text-gray-500 font-mono">POST /api/appointments</span>
              </div>
              <pre className="p-6 text-sm text-gray-300 font-mono overflow-x-auto leading-relaxed">
{`// Book an appointment via the API
const response = await fetch(
  'https://your-instance/api/appointments',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk_live_...',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      patientId: 'pat_abc123',
      doctorId: 'usr_dr_chen',
      startTime: '2026-03-19T14:00:00Z',
      type: 'wellness_exam',
      notes: 'Annual wellness, vaccines due'
    })
  }
);

// → { id: "apt_7f3k9...", status: "scheduled" }`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 px-8 py-16 sm:px-16 sm:py-20 text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-800/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight mb-4">
                See it in action.
              </h2>
              <p className="text-teal-100 text-lg max-w-xl mx-auto mb-8">
                The demo is live and loaded with real-looking data. Click around, try scheduling an appointment, write a SOAP note. It really is damn cool.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href={`${appUrl}/register`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-teal-700 shadow-lg hover:bg-teal-50 transition-all"
                >
                  Try the Live Demo
                  <ArrowRight className="w-4 h-4" />
                </a>
                <Link
                  href="/install"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-teal-400 px-8 py-3.5 text-base font-semibold text-white hover:bg-teal-600 transition-all"
                >
                  Self-host it
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
