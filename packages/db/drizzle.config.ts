import { createRequire } from "node:module";
import { defineConfig } from "drizzle-kit";

createRequire(import.meta.url)("@openpims/config/load-env");

export default defineConfig({
  schema: "./schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
