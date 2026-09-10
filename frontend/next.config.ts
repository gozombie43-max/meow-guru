import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs/config";

const configuredBackend = process.env.API_URL || process.env.AZURE_BACKEND_URL;
if (process.env.NODE_ENV === 'production' && !configuredBackend) {
  throw new Error('API_URL or AZURE_BACKEND_URL is required for production builds');
}
const BACKEND_URL = (configuredBackend || 'http://localhost:10000').replace(/\/+$/, '');
if (!['http:', 'https:'].includes(new URL(BACKEND_URL).protocol)) throw new Error('Backend URL must use HTTP or HTTPS');

const nextConfig: NextConfig = {
  images: {
    qualities: [75, 85],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "quizguru12345.blob.core.windows.net",
        pathname: "/**",
      },
    ],
  },
  turbopack: {
    // Resolve to the monorepo root so Turbopack can compile hoisted dependencies in CI.
    root: path.resolve(__dirname, ".."),
  },
  async redirects() {
    return [
      { source: "/polity", destination: "/general-awareness/polity", permanent: false },
      { source: "/economy", destination: "/general-awareness/economy", permanent: false },
      { source: "/economics", destination: "/general-awareness/economy", permanent: false },
      { source: "/science", destination: "/general-awareness/physics", permanent: false },
      { source: "/static", destination: "/general-awareness/static-gk", permanent: false },
      { source: "/static-gk", destination: "/general-awareness/static-gk", permanent: false },
      { source: "/general-awareness/economics", destination: "/general-awareness/economy", permanent: false },
      { source: "/general-awareness/static", destination: "/general-awareness/static-gk", permanent: false },
      { source: "/general-awareness/science", destination: "/general-awareness/physics", permanent: false },
      { source: "/general-awareness/general-science", destination: "/general-awareness/physics", permanent: false },
      { source: "/mathematics/arithmetic/time-speed-distance", destination: "/mathematics/arithmetic/time-and-distance", permanent: false },
      { source: "/mathematics/arithmetic/time-speed-distance/quiz", destination: "/mathematics/arithmetic/time-and-distance/quiz", permanent: false },
    ];
  },
  async rewrites() {
    return [
      {
        // /backend-api/api/access-code/verify
        //   → https://quizguru-backend.../api/access-code/verify
        source: "/backend-api/:path*",
        destination: `${BACKEND_URL}/:path*`,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
