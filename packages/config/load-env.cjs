/**
 * Load `.env` and `.env.local` from the monorepo root.
 * Require once at startup (Next config, drizzle-kit, seed scripts, etc.).
 */
const path = require("path");
const { config } = require("dotenv");

const root = path.resolve(__dirname, "../..");

config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local"), override: true });

module.exports = { root };
