import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OpenPIMS API Reference",
  description: "API documentation for OpenPIMS veterinary practice management",
};

// ── Endpoint definitions ─────────────────────────────────────

interface Endpoint {
  name: string;
  method: "GET" | "POST";
  description: string;
  input?: string;
  response?: string;
  auth?: string;
}

interface Section {
  id: string;
  title: string;
  description: string;
  endpoints: Endpoint[];
}

const sections: Section[] = [
  {
    id: "auth",
    title: "Authentication",
    description:
      "Register practices and retrieve the current user session. All other endpoints require a valid session cookie.",
    endpoints: [
      {
        name: "auth.register",
        method: "POST",
        description: "Register a new practice with an admin user account.",
        input: `{
  practiceName: string,
  name: string,
  email: string,
  password: string   // min 8 characters
}`,
        response: `{ success: true }`,
        auth: "None (public)",
      },
      {
        name: "auth.me",
        method: "GET",
        description: "Get the current authenticated user and practice details.",
        response: `{
  id: string,
  email: string,
  name: string,
  role: "admin" | "veterinarian" | "technician" | "front_desk",
  practiceId: string,
  practiceName: string
}`,
        auth: "Session cookie",
      },
    ],
  },
  {
    id: "clients",
    title: "Clients",
    description: "Manage pet owners / client records.",
    endpoints: [
      {
        name: "clients.list",
        method: "GET",
        description: "List clients with optional search and pagination.",
        input: `{
  search?: string,
  limit?: number,    // 1-100, default 25
  offset?: number    // default 0
}`,
        response: `{
  items: Client[],
  total: number
}`,
      },
      {
        name: "clients.search",
        method: "GET",
        description: "Quick search clients by name, email, or phone. Returns up to 10 results.",
        input: `{ query: string }`,
        response: `Client[]`,
      },
      {
        name: "clients.getById",
        method: "GET",
        description: "Get a single client with their patients.",
        input: `{ id: string }`,
        response: `{
  ...Client,
  patients: Patient[]
}`,
      },
      {
        name: "clients.create",
        method: "POST",
        description: "Create a new client record.",
        input: `{
  firstName: string,
  lastName: string,
  email?: string,
  phone?: string,
  address?: string,
  city?: string,
  state?: string,
  zip?: string
}`,
        response: `Client`,
      },
      {
        name: "clients.update",
        method: "POST",
        description: "Update an existing client.",
        input: `{
  id: string,
  firstName?: string,
  lastName?: string,
  email?: string,
  phone?: string,
  address?: string,
  city?: string,
  state?: string,
  zip?: string
}`,
        response: `Client`,
      },
      {
        name: "clients.delete",
        method: "POST",
        description: "Soft-delete a client record.",
        input: `{ id: string }`,
        response: `{ success: true }`,
      },
    ],
  },
  {
    id: "patients",
    title: "Patients",
    description: "Manage animal patient records, weights, and allergies.",
    endpoints: [
      {
        name: "patients.list",
        method: "GET",
        description: "List patients with optional filters.",
        input: `{
  search?: string,
  species?: string,
  status?: string,
  limit?: number,    // 1-100, default 25
  offset?: number    // default 0
}`,
        response: `{
  items: Patient[],
  total: number
}`,
      },
      {
        name: "patients.search",
        method: "GET",
        description: "Quick search patients by name. Returns up to 10 results.",
        input: `{ query: string }`,
        response: `Patient[]`,
      },
      {
        name: "patients.getById",
        method: "GET",
        description: "Get full patient details including weights, allergies, and owner info.",
        input: `{ id: string }`,
        response: `{
  ...Patient,
  weights: Weight[],
  allergies: Allergy[],
  ownerName: string
}`,
      },
      {
        name: "patients.create",
        method: "POST",
        description: "Create a new patient record.",
        input: `{
  clientId: string,
  name: string,
  species: string,
  breed?: string,
  color?: string,
  sex: "male" | "female" | "male_neutered" | "female_spayed" | "unknown",
  dateOfBirth?: string,
  microchipId?: string
}`,
        response: `Patient`,
      },
      {
        name: "patients.update",
        method: "POST",
        description: "Update an existing patient record.",
        input: `{
  id: string,
  name?: string,
  species?: string,
  breed?: string,
  color?: string,
  sex?: string,
  dateOfBirth?: string,
  microchipId?: string,
  status?: string
}`,
        response: `Patient`,
      },
      {
        name: "patients.delete",
        method: "POST",
        description: "Soft-delete a patient record.",
        input: `{ id: string }`,
        response: `{ success: true }`,
      },
      {
        name: "patients.addWeight",
        method: "POST",
        description: "Record a weight measurement.",
        input: `{
  patientId: string,
  weight: number,
  unit: string
}`,
        response: `Weight`,
      },
      {
        name: "patients.addAllergy",
        method: "POST",
        description: "Record a known allergy.",
        input: `{
  patientId: string,
  allergen: string,
  severity?: string,
  notes?: string
}`,
        response: `Allergy`,
      },
    ],
  },
  {
    id: "appointments",
    title: "Appointments",
    description: "Schedule and manage appointments.",
    endpoints: [
      {
        name: "appointments.list",
        method: "GET",
        description: "List appointments within a date range.",
        input: `{
  startDate: string,  // ISO date
  endDate: string,    // ISO date
  doctorId?: string
}`,
        response: `Appointment[]`,
      },
      {
        name: "appointments.getById",
        method: "GET",
        description: "Get full appointment details.",
        input: `{ id: string }`,
        response: `Appointment`,
      },
      {
        name: "appointments.create",
        method: "POST",
        description: "Schedule a new appointment.",
        input: `{
  patientId: string,
  clientId: string,
  typeId: string,
  doctorId: string,
  roomId?: string,
  startTime: string,    // ISO datetime
  endTime: string,      // ISO datetime
  notes?: string,
  reason?: string
}`,
        response: `Appointment`,
      },
      {
        name: "appointments.updateStatus",
        method: "POST",
        description: "Update appointment status (e.g., check-in, complete, cancel).",
        input: `{
  id: string,
  status: "scheduled" | "checked_in" | "in_progress" | "completed" | "cancelled" | "no_show"
}`,
        response: `Appointment`,
      },
      {
        name: "appointments.listTypes",
        method: "GET",
        description: "List available appointment types for the practice.",
        response: `AppointmentType[]`,
      },
      {
        name: "appointments.listDoctors",
        method: "GET",
        description: "List veterinarians available for scheduling.",
        response: `Doctor[]`,
      },
      {
        name: "appointments.listRooms",
        method: "GET",
        description: "List exam rooms.",
        response: `Room[]`,
      },
    ],
  },
  {
    id: "records",
    title: "Medical Records",
    description:
      "SOAP notes, vaccinations, lab results, procedures, problems, and prescriptions.",
    endpoints: [
      {
        name: "records.listSoapNotes",
        method: "GET",
        description: "List SOAP notes for a patient.",
        input: `{ patientId: string }`,
        response: `SoapNote[]`,
      },
      {
        name: "records.createSoapNote",
        method: "POST",
        description: "Create a SOAP note.",
        input: `{
  patientId: string,
  subjective: string,
  objective: string,
  assessment: string,
  plan: string
}`,
        response: `SoapNote`,
      },
      {
        name: "records.listVaccinations",
        method: "GET",
        description: "List vaccination records for a patient.",
        input: `{ patientId: string }`,
        response: `Vaccination[]`,
      },
      {
        name: "records.createVaccination",
        method: "POST",
        description: "Record a vaccination.",
        input: `{
  patientId: string,
  vaccineName: string,
  manufacturer?: string,
  lotNumber?: string,
  expirationDate?: string,
  nextDueDate?: string,
  notes?: string
}`,
        response: `Vaccination`,
      },
      {
        name: "records.listLabResults",
        method: "GET",
        description: "List lab results for a patient.",
        input: `{ patientId: string }`,
        response: `LabResult[]`,
      },
      {
        name: "records.createLabResult",
        method: "POST",
        description: "Create a lab result entry.",
        input: `{
  patientId: string,
  testName: string,
  category?: string,
  results?: object,
  notes?: string
}`,
        response: `LabResult`,
      },
      {
        name: "records.updateLabResultStatus",
        method: "POST",
        description: "Update the status of a lab result.",
        input: `{
  id: string,
  status: "pending" | "completed" | "reviewed"
}`,
        response: `LabResult`,
      },
      {
        name: "records.listProcedures",
        method: "GET",
        description: "List procedures performed on a patient.",
        input: `{ patientId: string }`,
        response: `Procedure[]`,
      },
      {
        name: "records.createProcedure",
        method: "POST",
        description: "Record a procedure.",
        input: `{
  patientId: string,
  name: string,
  description?: string,
  notes?: string
}`,
        response: `Procedure`,
      },
      {
        name: "records.listProblems",
        method: "GET",
        description: "List active and resolved problems for a patient.",
        input: `{ patientId: string }`,
        response: `Problem[]`,
      },
      {
        name: "records.createProblem",
        method: "POST",
        description: "Add a problem to the patient's problem list.",
        input: `{
  patientId: string,
  description: string,
  severity?: string,
  notes?: string
}`,
        response: `Problem`,
      },
      {
        name: "records.updateProblemStatus",
        method: "POST",
        description: "Mark a problem as resolved or reactivate it.",
        input: `{
  id: string,
  status: "active" | "resolved"
}`,
        response: `Problem`,
      },
      {
        name: "records.listPrescriptions",
        method: "GET",
        description: "List prescriptions for a patient.",
        input: `{ patientId: string }`,
        response: `Prescription[]`,
      },
      {
        name: "records.createPrescription",
        method: "POST",
        description: "Create a prescription.",
        input: `{
  patientId: string,
  drugName: string,
  dosage: string,
  frequency: string,
  duration?: string,
  quantity?: number,
  refills?: number,
  notes?: string
}`,
        response: `Prescription`,
      },
    ],
  },
  {
    id: "billing",
    title: "Billing",
    description: "Invoices, payments, services, and estimates.",
    endpoints: [
      {
        name: "billing.listInvoices",
        method: "GET",
        description: "List invoices with optional filters.",
        input: `{
  status?: string,
  isEstimate?: boolean,
  limit?: number,
  offset?: number
}`,
        response: `{
  items: Invoice[],
  total: number
}`,
      },
      {
        name: "billing.getInvoice",
        method: "GET",
        description: "Get full invoice with line items and payments.",
        input: `{ id: string }`,
        response: `{
  ...Invoice,
  items: InvoiceItem[],
  payments: Payment[]
}`,
      },
      {
        name: "billing.createInvoice",
        method: "POST",
        description: "Create an invoice or estimate.",
        input: `{
  clientId: string,
  patientId?: string,
  isEstimate?: boolean,
  items: {
    serviceId?: string,
    productId?: string,
    description: string,
    quantity: number,
    unitPrice: number
  }[],
  notes?: string
}`,
        response: `Invoice`,
      },
      {
        name: "billing.updateInvoiceStatus",
        method: "POST",
        description: "Update invoice status.",
        input: `{
  id: string,
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
}`,
        response: `Invoice`,
      },
      {
        name: "billing.convertEstimateToInvoice",
        method: "POST",
        description: "Convert an approved estimate into a billable invoice.",
        input: `{ id: string }`,
        response: `Invoice`,
      },
      {
        name: "billing.recordPayment",
        method: "POST",
        description: "Record a payment against an invoice.",
        input: `{
  invoiceId: string,
  amount: number,
  method: "cash" | "credit_card" | "check" | "bank_transfer" | "other",
  reference?: string,
  notes?: string
}`,
        response: `Payment`,
      },
      {
        name: "billing.listPayments",
        method: "GET",
        description: "List payments for an invoice.",
        input: `{ invoiceId: string }`,
        response: `Payment[]`,
      },
      {
        name: "billing.listServices",
        method: "GET",
        description: "List all services offered by the practice.",
        response: `Service[]`,
      },
      {
        name: "billing.listProducts",
        method: "GET",
        description: "List products available for invoicing.",
        response: `Product[]`,
      },
    ],
  },
  {
    id: "portal",
    title: "Client Portal",
    description:
      "Token-based public access for pet owners. No session required -- uses a unique access token per client.",
    endpoints: [
      {
        name: "portal.getClient",
        method: "GET",
        description: "Get client profile and pets via portal token.",
        input: `{ token: string }`,
        response: `{
  client: Client,
  pets: Patient[]
}`,
        auth: "Portal token",
      },
      {
        name: "portal.getPetDetail",
        method: "GET",
        description: "Get full pet details including medical history.",
        input: `{
  token: string,
  patientId: string
}`,
        response: `{
  ...Patient,
  vaccinations: Vaccination[],
  prescriptions: Prescription[],
  weights: Weight[],
  allergies: Allergy[]
}`,
        auth: "Portal token",
      },
      {
        name: "portal.getAppointments",
        method: "GET",
        description: "List upcoming appointments for the client.",
        input: `{ token: string }`,
        response: `Appointment[]`,
        auth: "Portal token",
      },
      {
        name: "portal.getInvoices",
        method: "GET",
        description: "List invoices for the client.",
        input: `{ token: string }`,
        response: `Invoice[]`,
        auth: "Portal token",
      },
      {
        name: "portal.requestAppointment",
        method: "POST",
        description: "Submit an appointment request from the portal.",
        input: `{
  token: string,
  patientId: string,
  reason: string,
  preferredDate?: string,
  preferredTime?: string
}`,
        response: `{ success: true }`,
        auth: "Portal token",
      },
    ],
  },
  {
    id: "webhooks",
    title: "Webhooks",
    description:
      "Subscribe to real-time events. Webhook payloads are signed with HMAC-SHA256 using the secret provided at creation.",
    endpoints: [
      {
        name: "webhooks.list",
        method: "GET",
        description: "List all webhooks for the practice.",
        response: `Webhook[]`,
        auth: "Admin only",
      },
      {
        name: "webhooks.create",
        method: "POST",
        description:
          "Create a webhook subscription. The secret is returned once and cannot be retrieved again.",
        input: `{
  url: string,
  events: WebhookEvent[]
}`,
        response: `{
  ...Webhook,
  secret: string   // shown once
}`,
        auth: "Admin only",
      },
      {
        name: "webhooks.toggle",
        method: "POST",
        description: "Enable or disable a webhook.",
        input: `{ id: string }`,
        response: `Webhook`,
        auth: "Admin only",
      },
      {
        name: "webhooks.delete",
        method: "POST",
        description: "Delete a webhook subscription.",
        input: `{ id: string }`,
        response: `{ success: true }`,
        auth: "Admin only",
      },
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    description: "Track products, stock levels, and suppliers.",
    endpoints: [
      {
        name: "inventory.list",
        method: "GET",
        description: "List inventory items with optional filters.",
        input: `{
  search?: string,
  category?: string,
  lowStock?: boolean,
  limit?: number,
  offset?: number
}`,
        response: `{
  items: InventoryItem[],
  total: number
}`,
      },
      {
        name: "inventory.create",
        method: "POST",
        description: "Add a new inventory item.",
        input: `{
  name: string,
  sku?: string,
  category?: string,
  quantity: number,
  minQuantity?: number,
  unitCost?: number,
  unitPrice?: number,
  supplierId?: string
}`,
        response: `InventoryItem`,
      },
      {
        name: "inventory.update",
        method: "POST",
        description: "Update an inventory item.",
        input: `{
  id: string,
  name?: string,
  sku?: string,
  category?: string,
  minQuantity?: number,
  unitCost?: number,
  unitPrice?: number,
  supplierId?: string
}`,
        response: `InventoryItem`,
      },
      {
        name: "inventory.adjustStock",
        method: "POST",
        description: "Adjust stock quantity (positive or negative).",
        input: `{
  id: string,
  adjustment: number,
  reason?: string
}`,
        response: `InventoryItem`,
      },
      {
        name: "inventory.listSuppliers",
        method: "GET",
        description: "List all suppliers.",
        response: `Supplier[]`,
      },
      {
        name: "inventory.createSupplier",
        method: "POST",
        description: "Add a new supplier.",
        input: `{
  name: string,
  contactName?: string,
  email?: string,
  phone?: string
}`,
        response: `Supplier`,
      },
    ],
  },
  {
    id: "communications",
    title: "Communications",
    description: "Track client communications across channels.",
    endpoints: [
      {
        name: "communications.list",
        method: "GET",
        description: "List communications with optional filters.",
        input: `{
  clientId?: string,
  status?: string,
  limit?: number,
  offset?: number
}`,
        response: `{
  items: Communication[],
  total: number
}`,
      },
      {
        name: "communications.getByClient",
        method: "GET",
        description: "Get all communications for a specific client.",
        input: `{ clientId: string }`,
        response: `Communication[]`,
      },
      {
        name: "communications.create",
        method: "POST",
        description: "Log a communication.",
        input: `{
  clientId: string,
  channel: "phone" | "sms" | "email" | "portal",
  direction: "inbound" | "outbound",
  subject?: string,
  content: string,
  status?: "pending" | "sent" | "delivered" | "read" | "failed"
}`,
        response: `Communication`,
      },
      {
        name: "communications.updateStatus",
        method: "POST",
        description: "Update communication status.",
        input: `{
  id: string,
  status: "pending" | "sent" | "delivered" | "read" | "failed"
}`,
        response: `Communication`,
      },
    ],
  },
];

const WEBHOOK_EVENTS = [
  { event: "appointment.created", description: "New appointment scheduled" },
  { event: "appointment.updated", description: "Appointment details changed" },
  {
    event: "appointment.status_changed",
    description: "Check-in, completion, cancellation",
  },
  { event: "patient.created", description: "New patient record created" },
  { event: "patient.updated", description: "Patient record modified" },
  { event: "client.created", description: "New client registered" },
  { event: "invoice.created", description: "New invoice generated" },
  { event: "invoice.paid", description: "Invoice fully paid" },
  { event: "prescription.created", description: "New prescription written" },
  {
    event: "vaccination.recorded",
    description: "Vaccination administered and recorded",
  },
];

// ── Components ───────────────────────────────────────────────

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
        method === "GET"
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      }`}
    >
      {method}
    </span>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {endpoint.name}
        </code>
        {endpoint.auth && endpoint.auth !== "Session cookie" && (
          <span className="ml-auto rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {endpoint.auth}
          </span>
        )}
      </div>
      <div className="space-y-3 px-4 py-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {endpoint.description}
        </p>
        {endpoint.input && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Input
            </p>
            <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {endpoint.input}
            </pre>
          </div>
        )}
        {endpoint.response && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              Response
            </p>
            <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {endpoint.response}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function ApiDocsPage() {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <nav className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:block">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-teal-600 dark:text-teal-400">
            OpenPIMS API
          </h2>
          <p className="text-xs text-slate-500">v1.0 Reference</p>
        </div>
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                {s.title}
                <span className="ml-1 text-xs text-slate-400">
                  ({s.endpoints.length})
                </span>
              </a>
            </li>
          ))}
          <li>
            <a
              href="#webhook-events"
              className="block rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              Webhook Events
            </a>
          </li>
        </ul>

        <div className="mt-8 border-t border-slate-200 pt-4 dark:border-slate-700">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Base URL
          </h3>
          <code className="block rounded bg-slate-50 p-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            /api/trpc/
          </code>
          <p className="mt-3 text-xs text-slate-500">
            All endpoints use tRPC. Query procedures use HTTP GET, mutations use
            HTTP POST. Input is JSON-encoded in the <code>input</code> query
            parameter (GET) or request body (POST).
          </p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 px-6 py-10 lg:px-12">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              OpenPIMS API Reference
            </h1>
            <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">
              Complete API documentation for the OpenPIMS veterinary practice
              management system. All endpoints are available via tRPC and return
              JSON responses.
            </p>

            {/* Quick info cards */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Authentication
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Session-based via NextAuth. Include cookies with requests.
                  Portal endpoints use token-based auth.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Multi-tenancy
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  All data is scoped to the authenticated user&apos;s practice.
                  No cross-practice data access is possible.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Real-time Events
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Subscribe to webhooks for appointment, patient, billing, and
                  prescription events.
                </p>
              </div>
            </div>
          </div>

          {/* Sections */}
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="mb-12">
              <div className="mb-4 border-b border-slate-200 pb-2 dark:border-slate-700">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {section.title}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {section.description}
                </p>
              </div>
              <div className="space-y-4">
                {section.endpoints.map((ep) => (
                  <EndpointCard key={ep.name} endpoint={ep} />
                ))}
              </div>
            </section>
          ))}

          {/* Webhook Events Reference */}
          <section id="webhook-events" className="mb-12">
            <div className="mb-4 border-b border-slate-200 pb-2 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Webhook Events
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Available event types for webhook subscriptions. Payloads are
                signed with HMAC-SHA256 using the webhook secret.
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Event
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-700 dark:bg-slate-800/50">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <tr key={ev.event}>
                      <td className="px-4 py-2">
                        <code className="text-sm font-medium text-teal-600 dark:text-teal-400">
                          {ev.event}
                        </code>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400">
                        {ev.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Payload example */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                Webhook Payload Format
              </h3>
              <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {`POST https://your-server.com/webhook
Content-Type: application/json
X-OpenPIMS-Signature: sha256=<hmac-sha256-hex>

{
  "event": "appointment.created",
  "timestamp": "2026-03-17T14:30:00Z",
  "practice_id": "uuid",
  "data": {
    "id": "uuid",
    "patientId": "uuid",
    "clientId": "uuid",
    "startTime": "2026-03-18T09:00:00Z",
    "status": "scheduled"
  }
}`}
              </pre>
            </div>

            {/* Signature verification */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="mb-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                Verifying Signatures
              </h3>
              <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {`import crypto from "crypto";

function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from("sha256=" + expected)
  );
}`}
              </pre>
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-16 border-t border-slate-200 pt-6 text-center text-sm text-slate-500 dark:border-slate-700">
            <p>
              OpenPIMS &mdash; Open-source veterinary practice management.
            </p>
            <p className="mt-1">
              API questions? Check the{" "}
              <a
                href="https://github.com/openpims/openpims"
                className="text-teal-600 hover:underline dark:text-teal-400"
              >
                GitHub repository
              </a>{" "}
              or open an issue.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
