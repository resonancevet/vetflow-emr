require("@openpims/config/load-env");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker production sets NEXT_OUTPUT_STANDALONE=1; local dev/test builds
  // use plain `next start` so PWA testing via Cloudflare tunnel works without
  // the standalone build's pnpm-monorepo chunk-tracing edge cases.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  transpilePackages: ["@openpims/api", "@openpims/db"],
  // Intuit App Store: disable caching on app/API responses that may contain
  // sensitive data. Static hashed assets under _next/static stay cacheable.
  async headers() {
    return [
      {
        source: "/((?!_next/static|_next/image|favicon.ico|favicon.svg|logo.svg|manifest.webmanifest|sw.js).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
