# Production deployment guide

This document describes how to bring VetRoamer online with real medical data.
For local-only use, see [LOCAL-DEV.md](./LOCAL-DEV.md).

## Prerequisites

- Managed PostgreSQL (Neon, Supabase, RDS, etc.)
- S3-compatible object storage (AWS S3, Cloudflare R2, etc.)
- A host for the Next.js app (Vercel, Railway, Fly.io, VPS, etc.)
- A domain with HTTPS

## Required secrets

Set these in your hosting provider's environment (never commit real values):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Managed Postgres connection string |
| `NEXTAUTH_SECRET` | Session signing secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Public app URL (`https://app.yourdomain.com`) |
| `S3_ENDPOINT` | Object storage endpoint (omit or use AWS default for S3) |
| `S3_ACCESS_KEY` | Object storage access key |
| `S3_SECRET_KEY` | Object storage secret key |
| `S3_BUCKET` | Bucket name for uploads |
| `S3_REGION` | Storage region |
| `NEXT_PUBLIC_DEMO_MODE` | Must be `false` |
| `ALLOW_REGISTRATION` | `true` only during initial setup, then `false` |

Optional integrations: `RESEND_API_KEY`, `TWILIO_*`, `STRIPE_*`, `CRON_SECRET`.

## Bring-up sequence

### Option A: Fresh production database

1. Provision managed Postgres and object storage.
2. Set all required environment variables on the host.
3. Deploy the app (or run locally pointed at production services).
4. Apply schema migrations:
   ```bash
   pnpm db:migrate
   ```
5. Open `/register` and create your real practice and admin account.
6. Set `ALLOW_REGISTRATION="false"`.
7. Verify login, create a test patient, finalize a SOAP note, and confirm audit entries appear under Settings → Audit Log.

### Option B: Restore from local backup

1. Provision managed Postgres and object storage.
2. Restore the Postgres dump to the managed database (using your provider's tools or `pg_restore`).
3. Restore object files to the bucket (extract `minio-data.tgz` and upload to S3/R2, or use provider sync tools).
4. Set environment variables and deploy the app.
5. Run `pnpm db:migrate` (applies any pending migrations; safe on restored DB).
6. Verify attachments load and audit log entries are present.

## Ongoing operations

- **Migrations:** After schema changes, run `pnpm db:generate` locally, commit migration files, then `pnpm db:migrate` on deploy.
- **Backups:** Schedule automated Postgres backups via your provider. Mirror object storage with provider lifecycle/backup rules.
- **Never use `db:push` in production** — it bypasses migration history.
- **Never run `SEED_DEMO=true pnpm db:seed`** against a database with real data.

## Local vs hosted

| | Local laptop | Hosted |
|--|-------------|--------|
| Cost | Free | ~$15–40/mo |
| Uptime | Laptop must be on | Always on |
| iPad access | Quick tunnel (URL changes) | Stable domain |
| Backups | `pnpm backup:local` + off-laptop copy | Provider-managed |
| Data location | Your machine | Cloud provider |

The S3 client is env-driven (`apps/web/lib/s3.ts`), so switching from local MinIO to S3/R2 requires only environment variable changes.
