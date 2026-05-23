# OpenVet integration — research notes

Status: **research only** (no implementation in VetRoamer v0). Revisit after v0 clinical + mobile UX is stable.

## What is OpenVet?

OpenVet typically refers to open veterinary knowledge / terminology resources used in clinical software (drug formularies, dosing references, terminology). Exact product boundaries vary by vendor — confirm which **OpenVet** you mean (website, API docs, license) before building.

## Questions to answer before integrating

1. **API availability** — Is there a documented REST/GraphQL API, or only bulk data dumps?
2. **Licensing** — Commercial use, attribution, per-seat fees?
3. **Data model fit** — How do OpenVet drug codes map to OpenVPM `prescriptions`, `products`, and `inventory` tables?
4. **Offline** — Does OpenVet require live API calls (conflicts with v3 offline goals)?
5. **Overlap** — OpenVPM already has prescriptions, inventory, and lab integration stubs (`IDEXX_API_KEY`, etc.). Would OpenVet replace or supplement those?

## Integration patterns (if API exists)

| Pattern | Use when |
|---------|----------|
| **Lookup on demand** | Vet searches drug → call OpenVet → prefill Rx form |
| **Periodic sync** | Nightly job imports formulary into `products` |
| **Deep link** | Open OpenVet reference in browser; no data in EMR |

Recommended starting point for field vets: **lookup on demand** inside the prescription create form (minimal schema change).

## OpenVPM touchpoints (if proceeding)

- UI: [`apps/web/components/patients/patient-clinical-add.tsx`](../apps/web/components/patients/patient-clinical-add.tsx) prescription form
- API: [`apps/web/server/routers/records.ts`](../apps/web/server/routers/records.ts) `createPrescription`
- Inventory: [`apps/web/server/routers/inventory.ts`](../apps/web/server/routers/inventory.ts) (v2 back office)

## Recommendation (VetRoamer v0–v2)

**Defer integration.** Finish v0 field workflow (schedule, patients, SOAP, photos) and v1 communications first. Re-evaluate OpenVet when:

- You need formulary autocomplete in Rx entry, and
- You have license + API credentials in hand.

## Next research steps (2–4 hours)

1. Identify exact OpenVet product URL and developer documentation
2. Request or locate API key / sandbox
3. Spike: one server route that proxies a drug search and returns JSON for the Rx form
4. Document license constraints in this file
