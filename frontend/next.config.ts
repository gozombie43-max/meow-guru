import type { NextConfig } from "next";
import path from "path";

const AZURE_BACKEND =
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
    // Use __dirname so this resolves correctly on any OS / CI environment.
    // The hardcoded Windows path broke Azure Linux builds.
    root: path.resolve(__dirname),
  },
  experimental: {
    cpus: 4,
    workerThreads: false,
  },
  async rewrites() {
    return [
      {
        // /backend-api/api/access-code/verify
        //   → https://quizguru-backend.../api/access-code/verify
        source: "/backend-api/:path*",
        destination: `${AZURE_BACKEND}/:path*`,
      },
    ];
  },
};

export default nextConfig;

