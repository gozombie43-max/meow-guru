import type { NextConfig } from "next";
import path from "path";

const BACKEND_URL =
  process.env.API_URL ||
  process.env.AZURE_BACKEND_URL ||
  "https://quizguru-backend-hsb0enbnhbbhh5ek.centralindia-01.azurewebsites.net";

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
    // Resolve to the monorepo root so Turbopack can compile hoisted dependencies on Vercel / CI.
    root: path.resolve(__dirname, ".."),
  },
  experimental: {
    cpus: 4,
    workerThreads: false,
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

export default nextConfig;
