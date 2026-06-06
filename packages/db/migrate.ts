import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

createRequire(import.meta.url)("@openpims/config/load-env");

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Production-safe migration runner.
 *
 * Applies every pending SQL migration in ./drizzle in order, tracking which
 * have run in the drizzle.__drizzle_migrations table. Safe to run repeatedly:
 * already-applied migrations are skipped. This is the path that should run on
 * deploy — never `db:push`, which diffs and mutates the schema in place.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "drizzle");

  // max: 1 — migrations must run on a single connection, in order.
  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log("Applying migrations from", migrationsFolder);
  await migrate(db, { migrationsFolder });
  console.log("Migrations up to date");

  await client.end();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
