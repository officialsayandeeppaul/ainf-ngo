/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
