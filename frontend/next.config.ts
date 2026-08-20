import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
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
};

export default nextConfig;
