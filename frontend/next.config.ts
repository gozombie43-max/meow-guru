import type { NextConfig } from "next";

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
    // Pin root to the frontend dir so Turbopack doesn't pick the parent
    // monorepo package.json as the workspace root (avoids tailwindcss
    // resolution errors and the "multiple lockfiles" warning).
    root: "C:\\Users\\91906\\Ai ssc\\frontend",
  },
};

export default nextConfig;
