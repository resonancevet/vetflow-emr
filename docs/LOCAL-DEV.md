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
pnpm db:seed
pnpm dev
```

Open http://localhost:3000/login

**Demo login:** `admin@neighborhoodvet.example.com` / `password123`  
Or click **Continue as demo veterinarian** when `NEXT_PUBLIC_DEMO_MODE=true`.

After login you land on **Schedule**.

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

## PostgreSQL port conflict

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
