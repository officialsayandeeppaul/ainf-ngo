const path = require("path");
const os = require("os");

// Self-disabling outside exFAT checkouts; see the file header for why.
require("./scripts/exfat-readlink-shim.cjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  agentRules: false,
  // The 25 Framer pages are route handlers that gzip their own body; the
  // portal is the only part of the app that renders React.
  poweredByHeader: false,
  outputFileTracingIncludes: {
    // Project pages are rebuilt at runtime (ISR) and version their scripts
    // from file contents (lib/asset-version.ts), so those folders ship too.
    "/*": [
      "./framer-html/**/*.html",
      "./public/assets/js/*.js",
      "./public/assets/css/*.css",
      "./public/i18n/*",
    ],
  },
  webpack(config, { dev }) {
    // This project lives on an exFAT volume, where readlink() on a regular file
    // reports EISDIR instead of EINVAL. Webpack's resolver treats that as fatal
    // rather than as "not a link", so the build dies on the first source file.
    // Nothing here is symlinked, so resolving them is pure overhead anyway.
    config.resolve.symlinks = false;
    if (dev) {
      // Pack snapshots fail on exFAT; keep the cache on the OS temp drive (NTFS).
      config.cache = {
        type: "filesystem",
        cacheDirectory: path.join(os.tmpdir(), "ainf-next-webpack"),
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(self \"https://verify.didit.me\"), microphone=(), geolocation=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      // Same policy as vercel.json, which takes precedence on Vercel. Image and
      // script names are not all content-hashed, so only fonts and ?v=
      // references (lib/asset-version.ts derives them from file contents) are
      // immutable. Framer bundles carry hashes but their copy is edited in
      // place, so they get a day, then stale-while-revalidate.
      {
        source: "/assets/img/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=31536000" },
        ],
      },
      {
        source: "/assets/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:dir(assets/js|assets/css|i18n|framer-site|framer-site-axinn)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      {
        source: "/:dir(assets/js|assets/css|i18n)/:path*",
        has: [{ type: "query", key: "v" }],
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:dir(framer-site|framer-site-axinn)/:file([^/]+\\.[A-Za-z0-9_-]{8}\\.mjs)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=31536000" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/framer-site/:path*.map",
        destination: "/assets/empty-sourcemap.json",
      },
      {
        source: "/framer-site-axinn/:path*.map",
        destination: "/assets/empty-sourcemap.json",
      },
    ];
  },
  async redirects() {
    return [
      { source: "/about%20us", destination: "/about-us", permanent: true },
      { source: "/contact", destination: "/contact-us", permanent: true },
      { source: "/privacy", destination: "/legal-pages/terms-conditions", permanent: true },
      { source: "/terms-of-use", destination: "/legal-pages/terms-conditions", permanent: true },
      { source: "/terms-conditions", destination: "/legal-pages/terms-conditions", permanent: true },
    ];
  },
};
module.exports = nextConfig;
