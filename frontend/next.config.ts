import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["quizguru12345.blob.core.windows.net"],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
