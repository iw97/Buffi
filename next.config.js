const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Pin project root when another lockfile exists higher in the tree (e.g. ~/package-lock.json).
  turbopack: {
    root: path.join(__dirname),
  },
  // Expose deployment hostname to the client so magic-link `continueUrl` matches preview/prod.
  env: {
    NEXT_PUBLIC_VERCEL_URL: process.env.VERCEL_URL ?? "",
  },
  // Browsers request /favicon.ico by default; we reuse the OG art until a dedicated .ico exists.
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/og-image.png" }];
  },
};

module.exports = nextConfig;
