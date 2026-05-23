# VetRoamer product scope

Mobile-first veterinary medical records for field vets. Fork of OpenVPM with a narrowed product surface.

## v0 goal (online field clinical)

Solo / full-access vet with internet connectivity:

1. Log in (single full-access account for now)
2. Schedule
3. Search or create client and patient
4. View history and alerts (SOAP, vaccines, medications, allergies)
5. Add SOAP notes with photo attachments
6. Tablet and phone friendly UI
7. Dark mode toggle

**Default landing after login:** `/schedule`

## v0 navigation (visible)

| Route | Purpose |
|-------|---------|
| `/schedule` | Day view, book and check in appointments |
| `/patients` | Patient search and records entry |
| `/records` | SOAP-centric clinical records |
| `/settings` | Profile, preferences, dark mode |

Clients are reachable via patient detail, Cmd+K search, and New Patient flows.

## Hidden in v0 (code retained, nav removed)

| Module | Route | Re-enable in |
|--------|-------|--------------|
| Dashboard | `/` | Optional later |
| Clients (nav) | `/clients` | v0 via search only |
| Billing | `/billing` | v2 |
| Inventory | `/inventory` | v2 |
| Inbox | `/inbox` | v1 |
| Whiteboard | `/whiteboard` | v2+ |
| Controlled substances | `/controlled-substances` | v2+ |
| Reports | `/reports` | v2 |

## Explicitly out of v0

- Offline use and sync on reconnect (v3)
- Multi-role login UX (deferred; use admin demo account)
- Billing, inventory, reports in daily workflow
- OpenVet integration (research only until v0–v2 stable)

## v1 — practice operations

- Client communication (email, SMS, portal)
- SOAP and treatment templates (Settings)

## v2 — back office

- Billing and invoicing
- Inventory and vendors
- Reports

## v3 — hard problems

- Offline-first architecture (PWA, local store, sync queue, conflict policy)

## Research (no code until stable)

- OpenVet integration: APIs, licensing, data model fit — see [openvet-integration-research.md](./openvet-integration-research.md)

## Technical notes

- Single `.env` at repo root; loaded via `@openpims/config/load-env`
- Local dev guide: [LOCAL-DEV.md](./LOCAL-DEV.md)
- Demo login: `admin@neighborhoodvet.example.com` / `password123`
