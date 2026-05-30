require("@openpims/config/load-env");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker production sets NEXT_OUTPUT_STANDALONE=1; local dev/test builds
  // use plain `next start` so PWA testing via Cloudflare tunnel works without
  // the standalone build's pnpm-monorepo chunk-tracing edge cases.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  transpilePackages: ["@openpims/api", "@openpims/db"],
};

module.exports = nextConfig;
