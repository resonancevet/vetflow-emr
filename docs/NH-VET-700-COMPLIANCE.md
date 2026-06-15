# NH Vet 700 Medical Record Compliance

Implementation reference for Vet 701.01 requirements in OpenPIMS.

## Tier 1 — Highest priority

| Requirement | Implementation |
|-------------|----------------|
| 24-hour record lockdown (701.01(c)) | `autoFinalizeStaleSoapNotes()` in `apps/web/lib/record-lockdown.ts`; runs on SOAP list + cron `GET /api/cron/lock-records` |
| Client consent / decline (701.01(b)(16)) | `client_consents` table; Compliance tab UI |
| Discharge instructions in DB + PDF (701.01(b)(20)) | `discharge_instructions` table; whiteboard + Compliance tab save PDF to storage |
| Owner/patient ID on every PDF page (701.01(b)(1)/(b)(2)) | `applyRecordPageFooters()` in `apps/web/lib/pdf.ts` |

## Tier 2 — Record completeness

| Requirement | Implementation |
|-------------|----------------|
| Structured vitals & exam status (701.01(b)(9)) | `exam_vitals` table; new SOAP form + Compliance tab |
| Diagnosis & prognosis (701.01(b)(11)) | SOAP fields `diagnosis`, `prognosis`, `reasonForVisit` |
| Treatments administered (701.01(b)(13)) | `treatment_administrations` + prescription `route` / `responseToTreatment` / `administeredAt` |

## Tier 3 — Specialized records

| Requirement | Implementation |
|-------------|----------------|
| Anesthesia monitoring (701.01(b)(14)/(b)(17)) | `anesthesia_records` table; Compliance tab |
| Dental / surgery team (701.01(b)(19)) | `procedure_team_members`; Procedures tab |
| Chart attachments | Upload categories: `cage-chart`, `dental-chart`, `surgical-report`, `anesthesia-monitor` |
| Custody dates (701.01(b)(5)) | `patient_custody` table; Compliance tab |

## Migration

Apply with `pnpm db:migrate` (migration `0002_nh_compliance.sql`).

## Cron

Set `CRON_SECRET` and schedule `GET /api/cron/lock-records` with header `x-cron-secret`.
