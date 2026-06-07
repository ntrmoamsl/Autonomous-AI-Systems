import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Enable instrumentation.ts for auto-publish background scheduler
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
