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
    "/*": ["./framer-html/**/*"],
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
      {
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/framer-site/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/framer-site-axinn/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/i18n/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
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
