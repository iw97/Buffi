const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Pin project root when another lockfile exists higher in the tree (e.g. ~/package-lock.json).
  turbopack: {
    root: path.join(__dirname),
  },
  // Netlify: @netlify/plugin-nextjs (OpenNext) handles build; no output or other overrides needed.
};

module.exports = nextConfig;

