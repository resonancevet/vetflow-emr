# Local development (VetRoamer)

## Prerequisites

- Node.js 20+
- pnpm 9.15.0 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- Docker Desktop

## First-time setup

```bash
cd ~/vetflow-emr
cp .env.example .env
# Edit .env if needed — keep DATABASE_URL at localhost:5432

docker compose -f docker/docker-compose.yml up -d
pnpm install
pnpm db:migrate
pnpm dev
```

Open http://localhost:3000/login and register your practice at `/register`.
Do **not** run `pnpm db:seed` for real data — seed loads demo patients and shared passwords.

To load demo data for testing only:

```bash
SEED_DEMO=true pnpm db:seed
```

## Clean start for real data

1. Ensure Docker Postgres is running.
2. Run `pnpm db:migrate` on an empty database (or restore from backup).
3. Set in `.env`:
   - `NEXT_PUBLIC_DEMO_MODE="false"`
   - `ALLOW_REGISTRATION="true"` (only while creating your practice)
   - A real `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
4. Start the app and open `/register` to create your practice and admin account.
5. After registration succeeds, set `ALLOW_REGISTRATION="false"` so strangers cannot create practices.

Do not run `pnpm db:seed` unless `SEED_DEMO=true` and you intentionally want demo data.

## Environment file

Use **one** `.env` at the **repo root** (not under `apps/web`). All apps load it via `@openpims/config/load-env`.

Optional: `.env.local` at repo root for personal overrides (gitignored).

## Database migrations

Schema changes are tracked as versioned SQL migrations in
`packages/db/drizzle/` (committed to git). This is the production-safe path —
a fresh database is built entirely from these files, in order.

**Workflow when you change the schema** (files under `packages/db/schema/`):

```bash
# 1. Generate a migration from your schema edits
pnpm db:generate
# 2. Apply pending migrations to your local DB
pnpm db:migrate
# 3. Commit the generated files in packages/db/drizzle/ alongside your schema change
```

- `pnpm db:migrate` applies only pending migrations and records them in the
  `drizzle.__drizzle_migrations` table. It is safe to run repeatedly and is the
  command to run on deploy.
- `pnpm db:push` diffs and mutates the schema in place without a migration
  file. It is fine for throwaway local experiments, but **do not use it in
  production** — it leaves no migration history.

## Local backup and restore

Backups need both the Postgres database and MinIO object files. Postgres holds
patients, records, SOAP notes, addenda, users, scheduling, and file metadata.
MinIO holds the actual uploaded photos/PDFs.

Create a timestamped local backup:

```bash
pnpm backup:local
```

By default this writes to `backups/local/<timestamp>/`:

- `postgres-openpims.dump` — custom-format Postgres dump
- `minio-data.tgz` — archive of the MinIO `/data` volume
- `manifest.txt` — basic backup metadata

Backups are gitignored. Copy important backups somewhere outside the repo too
(external drive, encrypted cloud storage, or another machine). A backup that
only lives on the same laptop does not protect against laptop loss.

Restore a backup into the local Docker stack:

```bash
VETFLOW_RESTORE_CONFIRM=restore-local-data pnpm backup:restore backups/local/<timestamp>
```

Restore is intentionally guarded because it overwrites the local Docker
Postgres database and MinIO object store.

Copy important backups off the laptop on a regular cadence (external drive or
encrypted cloud storage). A backup that only lives on the same machine does not
protect against laptop loss or theft.

## Demo mode (testing only)

When `NEXT_PUBLIC_DEMO_MODE="true"`, the login page shows a demo shortcut.
Keep this **false** when using real medical data.

**Demo login** (only after `SEED_DEMO=true pnpm db:seed`):  
`admin@neighborhoodvet.example.com` / `password123`

After login you land on **Schedule**.

If `pnpm db:migrate` fails silently or says role `openpims` does not exist:

1. Stop Homebrew Postgres: `brew services stop postgresql@18`
2. Or reset Docker volumes: `docker compose -f docker/docker-compose.yml down -v && docker compose -f docker/docker-compose.yml up -d`

Confirm Docker owns 5432: `lsof -i :5432` should show `com.docke`.

## Smoke test (manual)

1. Log in → Schedule
2. Cmd+K → search a patient → open record
3. Patients → open patient → add vaccination or medication
4. Records → New SOAP → attach photo → save
5. Toggle dark mode in top bar

## Automated smoke test

With app running (`pnpm dev`):

```bash
pnpm test:e2e e2e/vetroamer-smoke.spec.ts
```

## Product scope

See [vetroamer-scope.md](./vetroamer-scope.md).
