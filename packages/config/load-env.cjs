/**
 * Load env files from the monorepo root (later files override earlier):
 *   .env → .env.[NODE_ENV] → .env.local → .env.[NODE_ENV].local
 * Require once at startup (Next config, drizzle-kit, seed scripts, etc.).
 */
const path = require("path");
const { config } = require("dotenv");

const root = path.resolve(__dirname, "../..");

config({ path: path.join(root, ".env") });

const nodeEnv = process.env.NODE_ENV || "development";
config({ path: path.join(root, `.env.${nodeEnv}`), override: true });

config({ path: path.join(root, ".env.local"), override: true });
config({
  path: path.join(root, `.env.${nodeEnv}.local`),
  override: true,
});

module.exports = { root };
