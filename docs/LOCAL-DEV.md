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
pnpm db:push
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

## PostgreSQL port conflict

If `pnpm db:push` fails silently or says role `openpims` does not exist:

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
