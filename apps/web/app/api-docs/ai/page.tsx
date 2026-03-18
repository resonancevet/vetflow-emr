export default function AIIntegrationDocs() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-teal-600">
            Developer Documentation
          </p>
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            AI Integration Guide
          </h1>
          <p className="text-lg text-gray-600">
            Connect AI tools to OpenPIMS for automated clinical workflows,
            intelligent queries, and real-time event processing.
          </p>
        </div>

        {/* Overview */}
        <Section id="overview" title="Overview">
          <p className="mb-4 text-gray-700">
            OpenPIMS is designed to be <strong>AI-first</strong>. Every clinical
            action &mdash; creating SOAP notes, querying patient records,
            tracking vaccinations &mdash; is available via a structured API. This
            means AI scribes, voice agents, and dashboard assistants can
            integrate directly with your practice management system.
          </p>
          <p className="text-gray-700">
            All API endpoints use <strong>tRPC</strong> over HTTP. Authentication
            is session-based for the MVP, with API key authentication coming
            soon. All requests are scoped to the authenticated user&apos;s
            practice.
          </p>
        </Section>

        {/* SOAP Note Integration */}
        <Section id="soap-notes" title="SOAP Note Integration">
          <p className="mb-4 text-gray-700">
            Connect an AI scribe &mdash; such as{" "}
            <strong>Scribenote</strong>, <strong>VetRec</strong>, or{" "}
            <strong>HappyDoc</strong> &mdash; to automatically populate SOAP
            notes after each appointment. The AI listens to the consultation,
            generates structured clinical notes, and posts them directly to
            OpenPIMS.
          </p>

          <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Endpoint
          </h3>
          <CodeBlock>
            {`POST /api/trpc/ai.createSoapFromAI

Content-Type: application/json`}
          </CodeBlock>

          <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Input Schema
          </h3>
          <CodeBlock>
            {`{
  "patientId": "uuid",          // Required - the patient record
  "appointmentId": "uuid",      // Optional - link to appointment
  "subjective": "string",       // Patient history, owner complaints
  "objective": "string",        // Physical exam findings, vitals
  "assessment": "string",       // Diagnosis, differential list
  "plan": "string",             // Treatment plan, follow-up
  "source": "string"            // Required - e.g. "scribenote", "vetrec"
}`}
          </CodeBlock>

          <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Example (cURL)
          </h3>
          <CodeBlock>
            {`curl -X POST https://your-practice.openpims.com/api/trpc/ai.createSoapFromAI \\
  -H "Content-Type: application/json" \\
  -H "Cookie: next-auth.session-token=<SESSION>" \\
  -d '{
    "json": {
      "patientId": "a1b2c3d4-...",
      "subjective": "Owner reports decreased appetite x3 days...",
      "objective": "T: 101.5F, HR: 120, RR: 24. Mild dehydration...",
      "assessment": "Suspect early-stage renal disease...",
      "plan": "CBC/Chem panel, urinalysis. Recheck in 2 weeks.",
      "source": "scribenote"
    }
  }'`}
          </CodeBlock>
        </Section>

        {/* Structured Queries */}
        <Section id="structured-queries" title="Structured Queries">
          <p className="mb-6 text-gray-700">
            AI assistants can query OpenPIMS for actionable clinical insights.
            These endpoints return structured data optimized for AI consumption
            &mdash; no parsing required.
          </p>

          <QueryCard
            name="Overdue Vaccinations"
            endpoint="GET /api/trpc/ai.patientsOverdueVaccinations"
            description="Returns patients whose vaccinations are past due. Useful for automated reminder campaigns or AI-powered outreach."
            response={`[
  {
    "patientId": "uuid",
    "patientName": "Bella",
    "species": "canine",
    "clientName": "Jane Smith",
    "vaccineName": "Rabies",
    "nextDueDate": "2025-11-15",
    "daysOverdue": 42
  }
]`}
          />

          <QueryCard
            name="Patients Needing Follow-Up"
            endpoint="GET /api/trpc/ai.patientsNeedingFollowUp"
            description="Identifies patients seen in the last 7 days (checked out) who do not have a future appointment scheduled. Ideal for proactive care workflows."
            response={`[
  {
    "appointmentId": "uuid",
    "patientId": "uuid",
    "patientName": "Max",
    "species": "feline",
    "clientName": "John Doe",
    "lastVisit": "2026-03-14T15:30:00Z"
  }
]`}
          />

          <QueryCard
            name="Daily Practice Summary"
            endpoint="GET /api/trpc/ai.dailySummary"
            description="Returns an aggregate view of today's practice activity. Perfect for AI dashboard widgets, morning briefings, or end-of-day reports."
            response={`{
  "date": "2026-03-17",
  "appointments": {
    "total": 24,
    "byStatus": {
      "scheduled": 5,
      "checked_in": 3,
      "in_exam": 2,
      "checked_out": 12,
      "no_show": 1,
      "cancelled": 1
    }
  },
  "patientsSeen": 14,
  "soapNotesCreated": 11,
  "invoicesPaid": 8
}`}
          />
        </Section>

        {/* Webhook Events */}
        <Section id="webhooks" title="Webhook Events">
          <p className="mb-4 text-gray-700">
            Subscribe to real-time events for reactive AI workflows. When
            something happens in OpenPIMS, your AI system gets notified
            instantly.
          </p>

          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Available Events
            </h3>
            <div className="space-y-3">
              <EventRow
                event="appointment.created"
                description="New appointment scheduled"
              />
              <EventRow
                event="appointment.checked_in"
                description="Patient arrives and checks in"
              />
              <EventRow
                event="appointment.checked_out"
                description="Visit complete, patient discharged"
              />
              <EventRow
                event="soap_note.created"
                description="New SOAP note recorded"
              />
              <EventRow
                event="patient.created"
                description="New patient added to the system"
              />
              <EventRow
                event="invoice.paid"
                description="Invoice payment received"
              />
            </div>
          </div>

          <CodeBlock>
            {`// Webhook payload format
{
  "event": "appointment.checked_in",
  "timestamp": "2026-03-17T09:15:00Z",
  "practiceId": "uuid",
  "data": {
    "appointmentId": "uuid",
    "patientId": "uuid",
    "patientName": "Bella",
    "clientId": "uuid"
  }
}`}
          </CodeBlock>

          <p className="mt-4 text-sm text-gray-500">
            Webhook registration endpoint coming soon. Contact us for early
            access.
          </p>
        </Section>

        {/* Coming Soon */}
        <Section id="coming-soon" title="Coming Soon">
          <div className="grid gap-4 sm:grid-cols-2">
            <ComingSoonCard
              title="Voice Agent Integration"
              description="Connect voice AI agents for hands-free clinical documentation during appointments."
            />
            <ComingSoonCard
              title="Differential Diagnosis"
              description="AI-suggested differentials based on presenting signs, history, and species-specific data."
            />
            <ComingSoonCard
              title="Automated Triage"
              description="AI-powered phone triage that assesses urgency and routes to the right provider."
            />
            <ComingSoonCard
              title="API Key Authentication"
              description="Dedicated API keys for third-party integrations with granular permission scoping."
            />
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-16 border-t border-gray-200 pt-8 text-center text-sm text-gray-500">
          <p>
            OpenPIMS AI Integration API &mdash; Built for the next generation of
            veterinary care.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable components                                                 */
/* ------------------------------------------------------------------ */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-12">
      <h2 className="mb-4 text-2xl font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-900 p-4 text-sm leading-relaxed text-gray-100">
      <code>{children}</code>
    </pre>
  );
}

function QueryCard({
  name,
  endpoint,
  description,
  response,
}: {
  name: string;
  endpoint: string;
  description: string;
  response: string;
}) {
  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-1 text-lg font-semibold text-gray-900">{name}</h3>
      <code className="mb-3 block text-sm text-teal-600">{endpoint}</code>
      <p className="mb-4 text-sm text-gray-600">{description}</p>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Response
      </p>
      <CodeBlock>{response}</CodeBlock>
    </div>
  );
}

function EventRow({
  event,
  description,
}: {
  event: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <code className="shrink-0 rounded bg-teal-50 px-2 py-1 text-sm font-medium text-teal-700">
        {event}
      </code>
      <span className="text-sm text-gray-600">{description}</span>
    </div>
  );
}

function ComingSoonCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-5">
      <h3 className="mb-1 text-base font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
