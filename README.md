# OpenVPM

Open-source, cloud-native veterinary Practice Information Management System.

## Quick Start

```bash
git clone https://github.com/gettalky/openpims.git
cd openpims
cp .env.example .env
docker compose -f docker/docker-compose.yml up -d
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Frontend:** Next.js 14+ (App Router), TypeScript, shadcn/ui, Tailwind CSS
- **Backend:** tRPC, PostgreSQL, Drizzle ORM
- **Auth:** NextAuth.js (role-based: Admin, Veterinarian, Technician, Front Desk)
- **Monorepo:** Turborepo + pnpm workspaces

## Project Structure

```
openpims/
├── apps/web/         # Next.js app
├── apps/docs/        # API documentation
├── packages/db/      # Drizzle schema & migrations
├── packages/api/     # Shared types & Zod validators
├── packages/config/  # Shared TS, Tailwind, ESLint config
├── packages/email/   # Email templates
└── docker/           # Docker Compose for local dev
```

## License

MIT
