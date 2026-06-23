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

## Local dev vs production storage

| | Local laptop (`.env`) | Hosted deploy |
|--|----------------------|---------------|
| Database | Neon or Docker Postgres | Neon (or other managed Postgres) |
| File storage | MinIO at `localhost:9000` | Cloudflare R2 |
| Config file | `.env` (gitignored) | Host dashboard env vars, or `.env.production` |

Your laptop `.env` should **keep MinIO** for uploads. Do not point local dev at R2 unless you intentionally want to test against production storage.

Copy `.env.production.example` to `.env.production` only when running a local production build (`NODE_ENV=production pnpm --filter @openpims/web build && ...`). For Vercel, set variables in the project dashboard instead.

## Cloudflare R2 setup

1. [Cloudflare dashboard](https://dash.cloudflare.com) → **R2 Object Storage** → enable R2 (payment method required; generous free tier).
2. **Create bucket** — e.g. `vetflow-emr`. Keep it **private** (no public access).
3. **R2** → **API** → **Manage API tokens** → **Create API token** with **Object Read & Write**, scoped to your bucket.
4. Save the one-time values:
   - Access Key ID → `S3_ACCESS_KEY`
   - Secret Access Key → `S3_SECRET_KEY`
   - Endpoint (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`) → `S3_ENDPOINT`
5. Set `S3_BUCKET` to your bucket name and `S3_REGION` to `auto`.

No code changes are required — `apps/web/lib/s3.ts` is already S3-compatible with `forcePathStyle: true`.

## Vercel project setup

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new).
2. **Root Directory:** `apps/web` (the Next.js EMR app).
3. Enable **Include source files outside of the Root Directory** (monorepo support for `packages/*`).
4. **Build & Output Settings** — Vercel usually auto-detects Next.js; confirm:
   - **Install Command:** `pnpm install` (runs from repo root)
   - **Build Command:** `next build` (runs inside `apps/web`)
5. **Environment Variables** — add every value from `.env.production.example` for the **Production** environment. Use your Neon pooled `DATABASE_URL`, R2 credentials, and `NEXTAUTH_URL` set to your live URL (e.g. `https://app.yourdomain.com`).
6. Deploy, then run migrations against the production database (from your laptop with production `DATABASE_URL`, or a one-off Vercel/local command):
   ```bash
   DATABASE_URL="your-neon-url" pnpm db:migrate
   ```
7. Open `https://your-app.vercel.app/register`, create your practice, then set `ALLOW_REGISTRATION=false` in Vercel and redeploy (or update the env var without redeploy if your host supports runtime env refresh).

`apps/web/vercel.json` configures daily crons: appointment reminders at 8:00 UTC and SOAP auto-lockdown at 9:00 UTC. Vercel Hobby allows once-per-day schedules only (not hourly). SOAP notes are also auto-finalized when listed. Set `CRON_SECRET` in Vercel — Vercel sends it as `Authorization: Bearer …` on cron invocations.

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
