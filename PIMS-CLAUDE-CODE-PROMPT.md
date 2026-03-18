# OpenPIMS — Open-Source Veterinary Practice Information Management System

## Claude Code Kickoff Prompt

Copy everything below the line into a new Claude Code session to kick off the build.

---

You are building **OpenPIMS** — a modern, open-source, cloud-native veterinary Practice Information Management System designed to be the first truly great free PIMS for independent veterinary clinics. This is meant to be a real, meaningful, production-grade project released on GitHub for anyone to use.

## Why This Exists

The veterinary PIMS market is broken. Here's what our research uncovered:

**The problem for clinics:**
- ezyVet is powerful but "extremely nonuser friendly," "very clunky," has a steep learning curve, slow performance, and declining support quality. No AI features yet.
- ProVet Cloud has "terrible" financial reporting, "non-existent" customer support post-implementation, and features promised during sales that don't materialize.
- Instinct is well-loved but has limited third-party integrations and occasional performance issues.
- Shepherd is the most modern (AI SOAP notes via TranscribeAI, DiagnoseAI) but falls short on inventory customization and financial reporting, and charges for texting.
- Legacy systems like Cornerstone and Avimark have click-heavy interfaces, system crashes, and no cloud access.
- Every commercial PIMS locks clinics into expensive subscriptions ($200-$600+/mo) with proprietary data formats.

**The problem for AI developers:**
- Jonathan Ayers (former IDEXX CEO) is actively surveying AI developers about PIMS vendor API access barriers. His Feb 2026 paper "PIMS in the Age of AI: Weather the Storm or Wither?" asks whether AI agents will disrupt PIMS as the "system of record."
- Most PIMS have closed or poorly documented APIs, making it nearly impossible for AI tools to read/write patient data.
- There is no widely adopted data interoperability standard in veterinary medicine (unlike human healthcare).

**The open-source gap:**
- OpenVPMS exists but is Java-based, dated UI, and primarily Australian-focused.
- Ababu on GitHub is PHP/MariaDB, inactive since Sept 2024, no releases published.
- A few student projects exist (React+Spring Boot, Rails+React) but none are production-ready.
- There is NO modern, well-designed, open-source PIMS with an open API. This is the gap.

**Real user needs (from Emily Falls, DVM — Owner of Burnt Hills Veterinary Hospital, a real practice manager we worked with):**
1. Schedule non-urgent appointments directly in the PIMS, differentiating doctor-specific vs. non-specific appointments
2. Field non-urgent client questions and route them as pending communications for staff review
3. Enter medication refill requests, checking if refills are available or if doctor approval is needed
4. Automate hospital forms — let clients fill them out or have an agent complete them over the phone
5. Online scheduling that reads directly from the PIMS appointment planner (not a separate rebuilt schedule)
6. Outbound calls to proactively schedule appointments and follow-ups
7. Direct integration — "The big piece missing is direct integration with EzyVet, which would significantly reduce staff time"

Her core metric: **"I would need to see the product benefit us by reducing our staff hours."**

## What We're Building

A modern, open-source PIMS that is:
1. **Beautiful and dead-simple to use** — Practice managers and front desk staff should be productive within a single shift
2. **API-first** — Every feature accessible via a well-documented REST + WebSocket API so AI tools, voice agents, and third-party integrations can read AND write back
3. **Cloud-native but self-hostable** — Run it on our cloud or your own server
4. **Free and open source** — MIT licensed, community-driven

## Tech Stack

- **Frontend:** Next.js 14+ (App Router) with TypeScript
- **UI Library:** shadcn/ui + Tailwind CSS + Radix UI primitives
- **State Management:** Zustand for client state, TanStack Query for server state
- **Backend:** Next.js API routes + tRPC for type-safe API layer
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** NextAuth.js (multi-tenant, role-based: Admin, Veterinarian, Technician, Front Desk)
- **Real-time:** WebSockets via Socket.io for live whiteboard updates, chat, notifications
- **Search:** Full-text search via PostgreSQL tsvector (upgrade path to Meilisearch)
- **File Storage:** S3-compatible (MinIO for self-hosted)
- **Deployment:** Docker Compose for self-hosting, Vercel/Railway for cloud
- **Testing:** Vitest + Playwright for E2E
- **Monorepo:** Turborepo structure

## Design System — "Veterinary Attio"

The UI should feel like **Attio CRM meets a veterinary clinic** — clean, minimal, professional, and fast. Think: a practice manager who hates their current software opens this and immediately feels relief.

### Design Principles
- **White/light backgrounds** as the dominant canvas
- **Soft gray** (#F7F8FA) for sidebar, cards, and secondary surfaces
- **Single accent color:** A warm teal (#0D9488) — professional, calming, associated with healthcare/veterinary without being "cartoon pet" territory. Use sparingly for primary actions, active states, and key indicators.
- **Typography:** Clean sans-serif. Use `Inter` for body text (it's a workhorse for data-dense UIs) paired with `DM Sans` for headings (slightly warmer, more approachable). Generous line-height, clear hierarchy.
- **Spacing:** Generous whitespace. 8px grid system. Nothing should feel cramped.
- **Borders:** 1px solid #E5E7EB. Subtle. Cards use border, not shadow (Attio-style).
- **Border radius:** 8px for cards and containers, 6px for inputs and buttons, full-round for avatars and badges.
- **Shadows:** Minimal. Only on elevated elements like modals and dropdowns: `0 4px 6px -1px rgba(0,0,0,0.07)`.
- **Data density:** Dense but readable. Spreadsheet-style tables for records (like Attio's list views) with comfortable row height (44-48px).
- **Navigation:** Left sidebar (collapsible, 240px) with icon + label. Clean, flat, no nested menus visible by default.
- **Status indicators:** Small colored dots (8px), not heavy badges. Green for active/healthy, amber for pending/attention, red for urgent/overdue.
- **Empty states:** Warm, encouraging illustrations (not sad/empty). Guide users to take action.
- **Animations:** Subtle. 150ms transitions on hover states. No bouncing, no sliding panels. Fade-in for new content.

### Dark Mode
Support dark mode from day one (Tailwind `dark:` classes). Dark surfaces: #0F172A base, #1E293B cards.

## Core Modules (Priority Order)

### Phase 1 — Foundation (MVP)

**1. Patient & Client Management**
- Client records: name, contact info, address, emergency contact, preferred communication method, notes
- Patient records: species, breed, name, DOB/age, sex, weight history (with trend chart), color/markings, microchip #, photo
- Multi-pet households linked to single client
- Client communication preferences and history log
- Search: instant fuzzy search across clients and patients from a global search bar (Cmd+K)

**2. Appointment Scheduling**
- Visual calendar (day/week/month views) — column-per-doctor in day view
- Appointment types with configurable durations, colors, and required resources
- Doctor-specific vs. any-doctor scheduling
- Drag-and-drop rescheduling
- Recurring appointments
- Appointment status flow: Scheduled → Checked In → In Exam → Checked Out
- Waitlist management
- Block scheduling (lunch, surgery blocks, meetings)
- Online booking widget (embeddable) that reads real availability from the PIMS

**3. Electronic Medical Records (EMR)**
- SOAP notes (Subjective, Objective, Assessment, Plan) with rich text editor
- Problem list (active/resolved/chronic)
- Vaccination records with reminders and certificate generation
- Lab results viewer with reference ranges and trend graphs
- Prescription management: active meds, dosing calculator, refill tracking, refill-available flag
- Allergy/reaction alerts that appear prominently on patient header
- Document/image attachments (x-rays, photos, uploaded PDFs)
- Clinical templates (customizable per practice)
- Treatment plans with cost estimates

**4. Billing & Invoicing**
- Treatment-to-invoice flow: charges auto-populate as services are administered (like Shepherd)
- Itemized invoices with tax calculation
- Payment processing integration points (Stripe, Square)
- Estimates that convert to invoices
- Payment plans / account balances
- End-of-day reconciliation report
- Revenue by doctor, service, time period
- Client balance alerts

**5. Inventory Management**
- Product catalog (medications, supplies, food)
- Stock levels with reorder point alerts
- Lot/batch tracking with expiration dates
- Usage auto-deduction when dispensed from EMR
- Purchase order generation
- Multi-location inventory (for multi-branch clinics)
- Markup/pricing rules

### Phase 2 — Communication & Intelligence

**6. Client Communication Hub**
- Unified inbox: calls, texts, emails, portal messages in one timeline
- SMS/email appointment reminders (configurable timing)
- Vaccination/wellness reminders
- Bulk messaging for campaigns (dental month, etc.)
- Two-way SMS
- Email templates
- Communication log on client record

**7. Practice Whiteboard / Dashboard**
- Real-time patient status board (like a hospital whiteboard)
- Shows: patient name, doctor, room/status, time in, procedure, notes
- Color-coded by status
- WebSocket-powered — updates live across all screens
- Configurable columns per practice

**8. Reporting & Analytics**
- Daily/weekly/monthly revenue reports
- Production by doctor
- Appointment utilization (no-show rates, fill rates)
- Top services/products
- Client retention and new client tracking
- Accounts receivable aging
- Exportable to CSV/PDF
- Dashboard with KPI cards

**9. Client Portal**
- Pet health records view
- Appointment request/booking
- Prescription refill requests
- Vaccination certificates download
- Invoice/payment history
- Secure messaging to clinic
- Form completion (pre-visit paperwork)

### Phase 3 — AI & Ecosystem

**10. Open API & Integrations**
- Full REST API with OpenAPI/Swagger documentation
- Webhook system for real-time events (appointment created, patient checked in, invoice paid, etc.)
- OAuth2 for third-party app authorization
- FHIR-inspired data models (adapted for veterinary — there's no vet FHIR standard yet, so we define one)
- Integration guides for: lab equipment (IDEXX, Abaxis), payment processors, AI voice agents, telemedicine
- API rate limiting, scoping, and audit logging
- **This is the killer feature.** No other open-source PIMS has a real, well-documented, read-write API.

**11. AI-Ready Architecture**
- Structured data models that AI can query (e.g., "show me all patients overdue for rabies vaccination")
- Event stream that AI agents can subscribe to
- Slots for AI features to plug in: SOAP note generation, triage assistant, differential diagnosis suggestions
- Voice agent integration points: appointment booking, refill requests, form completion
- The PIMS is the system of record; AI agents are first-class consumers and contributors

## Project Structure

```
openpims/
├── apps/
│   ├── web/                    # Next.js frontend + API routes
│   │   ├── app/                # App Router pages
│   │   │   ├── (auth)/         # Login, register, forgot password
│   │   │   ├── (dashboard)/    # Main app layout
│   │   │   │   ├── patients/   # Patient list, detail, new
│   │   │   │   ├── clients/    # Client management
│   │   │   │   ├── schedule/   # Calendar views
│   │   │   │   ├── records/    # EMR, SOAP notes
│   │   │   │   ├── billing/    # Invoices, payments
│   │   │   │   ├── inventory/  # Stock management
│   │   │   │   ├── inbox/      # Communication hub
│   │   │   │   ├── whiteboard/ # Live patient board
│   │   │   │   ├── reports/    # Analytics dashboard
│   │   │   │   └── settings/   # Practice config, users, roles
│   │   │   └── portal/         # Client-facing portal
│   │   ├── components/         # Shared UI components
│   │   │   ├── ui/             # shadcn/ui base components
│   │   │   ├── layout/         # Sidebar, header, navigation
│   │   │   ├── patients/       # Patient-specific components
│   │   │   ├── schedule/       # Calendar components
│   │   │   ├── records/        # EMR components
│   │   │   └── common/         # Search, data tables, forms
│   │   ├── lib/                # Utilities, hooks, helpers
│   │   ├── server/             # tRPC routers, server utils
│   │   └── styles/             # Global styles, design tokens
│   └── docs/                   # API documentation site (Mintlify or Nextra)
├── packages/
│   ├── db/                     # Drizzle schema, migrations, seed data
│   ├── api/                    # Shared API types and validators (Zod)
│   ├── config/                 # Shared config (ESLint, TypeScript, Tailwind)
│   └── email/                  # Email templates (React Email)
├── docker/
│   ├── docker-compose.yml      # Full stack local dev
│   ├── docker-compose.prod.yml # Production deployment
│   └── Dockerfile              # Multi-stage build
├── .github/
│   ├── workflows/              # CI/CD (lint, test, build, deploy)
│   └── ISSUE_TEMPLATE/
├── turbo.json
├── package.json
├── README.md                   # Project overview, screenshots, quick start
├── CONTRIBUTING.md
├── LICENSE                     # MIT
└── CHANGELOG.md
```

## Database Schema (Key Tables)

Design the schema with these core entities. Use Drizzle ORM with PostgreSQL. Every table gets `id` (UUID), `created_at`, `updated_at`, `deleted_at` (soft delete). Multi-tenant via `practice_id` on every table.

### Core Entities
- **practices** — Multi-tenant root. name, address, phone, email, settings (JSONB), timezone, logo_url, subscription_tier
- **locations** — Multi-location support. practice_id, name, address, phone, is_primary (for multi-branch clinics)
- **users** — Auth + profile. email, password_hash, name, role (enum: admin, veterinarian, technician, front_desk), practice_id, avatar_url, license_number (for vets), location_id
- **clients** — Pet owners. first_name, last_name, email, phone, address, preferred_contact_method, notes, practice_id
- **patients** — Animals. name, species (enum), breed, sex (enum: male, female, male_neutered, female_spayed), dob, color, microchip_number, photo_url, client_id, status (active/inactive/deceased), practice_id

### Patient Clinical Data (typed tables, NOT JSONB blobs)
- **patient_weights** — patient_id, weight_kg, recorded_at, recorded_by (enables weight trend charts)
- **patient_allergies** — patient_id, allergen, reaction, severity (mild/moderate/severe), noted_by, noted_at
- **soap_notes** — patient_id, appointment_id, author_id, subjective, objective, assessment, plan, practice_id
- **vaccination_records** — patient_id, vaccine_name, lot_number, manufacturer, administered_by, administered_at, next_due_date, certificate_url, practice_id
- **lab_results** — patient_id, appointment_id, test_name, result_value, unit, reference_range_low, reference_range_high, status (pending/completed/reviewed), ordered_by, reviewed_by, practice_id
- **procedures** — patient_id, appointment_id, name, description, performed_by, anesthesia_used, duration_minutes, notes, practice_id
- **clinical_notes** — patient_id, author_id, note_type (general/follow_up/phone_call), content, practice_id
- **problem_list** — patient_id, description, status (active/resolved/chronic), onset_date, resolved_date, practice_id
- **cases** — patient_id, title, description, status (open/closed), opened_at, closed_at, primary_vet_id, practice_id (tracks ongoing conditions across multiple visits)
- **case_entries** — case_id, appointment_id, medical_record_type, medical_record_id, notes (links visits to cases)

### Scheduling & Resources
- **appointments** — start_time, end_time, type_id, patient_id, client_id, doctor_id, status (enum: scheduled/confirmed/checked_in/in_exam/checked_out/no_show/cancelled), room_id, notes, recurring_series_id, practice_id
- **appointment_types** — name, duration_minutes, color, requires_doctor, default_room_type, practice_id
- **recurring_series** — frequency (weekly/monthly/annual), interval, end_date, practice_id
- **rooms** — name, type (exam/surgery/treatment/boarding), location_id, practice_id
- **staff_schedules** — user_id, day_of_week, start_time, end_time, location_id, practice_id (defines availability)

### Prescriptions & Medications
- **prescriptions** — patient_id, medication_name, dosage, frequency, quantity, refills_remaining, prescribed_by, start_date, end_date, status, practice_id
- **drug_interactions** — drug_a, drug_b, severity (minor/moderate/major), description (reference table for safety checks)

### Billing & Inventory
- **services** — name, code, category, default_price, taxable, practice_id (distinct from products)
- **invoices** — client_id, patient_id, appointment_id, status (draft/sent/paid/overdue/void), subtotal, tax, total, paid_amount, due_date, practice_id
- **invoice_items** — invoice_id, description, quantity, unit_price, total, item_type (service/product), item_id
- **products** — name, sku, category (medication/supply/food), unit_price, cost_price, stock_quantity, reorder_point, lot_number, expiration_date, location_id, practice_id
- **suppliers** — name, contact_email, phone, address, notes, practice_id
- **purchase_orders** — supplier_id, status (draft/ordered/received), total, practice_id

### Communication & Integration
- **communications** — client_id, channel (enum: phone, sms, email, portal), direction (inbound/outbound), content, status, assigned_to, practice_id
- **webhooks** — url, events (array), secret, active, practice_id
- **api_keys** — key_hash, name, scopes (array), last_used_at, practice_id
- **audit_log** — user_id, action, entity_type, entity_id, changes (JSONB), ip_address, practice_id

## Security & Multi-Tenancy

This section is critical for production safety:

### Row-Level Security (RLS)
- Enable PostgreSQL RLS on ALL tenant-scoped tables
- Create a `set_tenant_context()` function that sets `current_setting('app.current_practice_id')`
- Every RLS policy: `USING (practice_id = current_setting('app.current_practice_id')::uuid)`
- Middleware in Next.js sets tenant context on every request based on authenticated user's practice_id

### Authentication (NextAuth.js)
- **MVP providers:** Email/password with bcrypt hashing + email verification
- **Session strategy:** Database sessions (not JWT) for revocability
- **Future:** Add Google OAuth, magic links
- Custom NextAuth adapter for Drizzle ORM

### Role-Based Access Control (RBAC)
Enforce via middleware on every tRPC procedure:
- **Admin:** Full access. Manage users, billing, settings, API keys.
- **Veterinarian:** Full clinical access. Create/edit medical records, prescriptions, procedures. View billing. Cannot manage users or practice settings.
- **Technician:** Create/edit patient records, vitals, lab results. Cannot prescribe medications or sign off SOAP notes. Can view but not edit invoices.
- **Front Desk:** Manage appointments, clients, check-in/check-out, invoices, communications. Cannot access clinical records beyond viewing vaccination status and allergies.

### Data Migration & Export
- **Import:** CSV template importers for clients, patients, products, vaccination records (covers 80% of migration needs from any PIMS)
- **Export:** Full data export in JSON + CSV formats at any time. Clinics own their data, period.
- **Backup:** Automated daily PostgreSQL `pg_dump` via cron in Docker, configurable retention (default 30 days), optional S3 upload

## tRPC Architecture

Organize tRPC routers by domain module, matching the feature structure:

```
server/
├── trpc.ts                 # Base tRPC init, context, middleware
├── routers/
│   ├── _app.ts             # Root router (merges all sub-routers)
│   ├── auth.ts             # Login, register, session
│   ├── clients.ts          # Client CRUD, search
│   ├── patients.ts         # Patient CRUD, weight history, allergies
│   ├── appointments.ts     # Scheduling, status transitions
│   ├── records.ts          # SOAP notes, vaccinations, labs, procedures
│   ├── prescriptions.ts    # Rx management, refill tracking
│   ├── billing.ts          # Invoices, payments, estimates
│   ├── inventory.ts        # Products, stock, purchase orders
│   ├── communications.ts   # Inbox, messages, reminders
│   ├── reports.ts          # Analytics queries
│   └── webhooks.ts         # Webhook management, API key admin
└── middleware/
    ├── tenantContext.ts     # Sets practice_id from session, applies RLS
    ├── rbac.ts             # Role-based procedure guards
    └── rateLimiter.ts      # Per-API-key rate limiting
```

### REST API Export
Use `trpc-openapi` to expose every tRPC procedure as a REST endpoint alongside the type-safe client. This gives us:
- Type-safe frontend calls via `@trpc/react-query`
- Standard REST API with OpenAPI/Swagger docs for third-party consumers
- Auto-generated API documentation from Zod schemas

### Webhook Delivery
- Database-triggered event queue (not polling) — use PostgreSQL `LISTEN/NOTIFY` or a lightweight job queue (BullMQ with Redis)
- Webhook payloads signed with HMAC-SHA256
- Exponential backoff retry (3 attempts: 1min, 5min, 30min)
- Webhook delivery log with response status codes

### Error Handling
Standard error envelope for all API responses:
```json
{ "error": { "code": "NOT_FOUND", "message": "Patient not found", "details": {} } }
```

## Performance Targets

- **Page load:** < 200ms for any dashboard page (use React Server Components for initial load)
- **Search:** < 100ms for fuzzy patient/client search (PostgreSQL trigram index + `pg_trgm`)
- **API response:** < 300ms for any single-record CRUD operation
- **Calendar render:** < 500ms for week view with 50+ appointments
- **Whiteboard update:** < 50ms latency for real-time status changes via WebSocket
- **Lighthouse score:** > 90 for Performance, Accessibility, Best Practices

## Getting Started Instructions (for the README)

The project should be startable with:
```bash
git clone https://github.com/gettalky/openpims.git
cd openpims
cp .env.example .env
docker compose up -d    # starts PostgreSQL + MinIO
pnpm install
pnpm db:push            # apply schema
pnpm db:seed            # seed demo data (sample clinic, clients, patients, appointments)
pnpm dev                # starts on localhost:3000
```

## Seed Data

Create realistic demo data for "Burnt Hills Veterinary Hospital":
- 3 veterinarians, 2 technicians, 2 front desk staff
- 25 clients with 40 patients (mix of dogs, cats, a rabbit, a parrot)
- 2 weeks of appointments (past and future)
- Sample SOAP notes, vaccination records, prescriptions
- Sample invoices in various states
- Inventory with 50 products

## Implementation Order

Start with:
1. **Project scaffolding** — Turborepo, Next.js app, Tailwind + shadcn/ui setup, PostgreSQL + Drizzle
2. **Auth & multi-tenancy** — Login/register, role-based access, practice setup wizard
3. **Design system** — Implement the sidebar layout, global search (Cmd+K), data table component, form components following the "Veterinary Attio" design spec above
4. **Patient & Client CRUD** — The heart of the system. List views (table), detail views, search, create/edit forms
5. **Appointment scheduling** — Calendar views, booking flow, status management
6. **EMR / SOAP notes** — Rich text medical records, problem list, vaccination tracking
7. **Billing** — Invoice generation, payment tracking
8. **API documentation** — OpenAPI spec auto-generated from tRPC, webhook management

## Key Differentiators to Maintain

Throughout the build, never lose sight of these:

1. **Speed** — Page loads under 200ms. Instant search. Optimistic updates everywhere.
2. **Simplicity** — If a feature requires reading a manual, redesign it. Emily Falls said her team rejected tools that required "modifying current workflows."
3. **API-first** — Every UI action goes through the API. If the UI can do it, an API consumer can too.
4. **Open data** — Clinics own their data. Export everything. Import from competitors. No lock-in.
5. **Beautiful defaults** — Out of the box, it should look like a $500/mo SaaS product, not an open-source afterthought.

---

*This prompt was researched and synthesized from: review analysis of ezyVet, ProVet Cloud, Instinct, and Shepherd; emails from Dr. Emily Falls (Burnt Hills Veterinary Hospital); Jon Ayers' PIMS in the Age of AI research and AI Innovator Survey; analysis of OpenVPMS and Ababu (existing open-source options); Attio CRM design patterns; and industry analysis from Capterra, G2, Software Advice, and veterinary industry publications.*
