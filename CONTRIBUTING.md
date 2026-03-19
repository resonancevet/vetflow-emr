# Contributing to OpenVPM

Thank you for your interest in contributing to OpenVPM!

## Development Setup

1. **Prerequisites**: Node.js 20+, pnpm 9+, Docker
2. **Clone and install**:
   ```bash
   git clone https://github.com/gettalky/openpims.git
   cd openpims
   cp .env.example .env
   pnpm install
   ```
3. **Start services**:
   ```bash
   docker compose -f docker/docker-compose.yml up -d
   pnpm db:push
   pnpm db:seed
   pnpm dev
   ```

## Project Structure

- `apps/web/` — Next.js frontend + API (tRPC)
- `packages/db/` — Drizzle ORM schema and migrations
- `packages/api/` — Shared Zod validators and types
- `packages/config/` — Shared TypeScript, Tailwind, ESLint config

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm build` to verify no type errors
4. Submit a pull request

## Code Style

- TypeScript strict mode
- Tailwind CSS for styling (follow existing design tokens)
- tRPC for all API endpoints
- Drizzle ORM for database queries

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
