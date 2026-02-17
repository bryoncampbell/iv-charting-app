import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Avoid build failure on ESLint warnings (fix lint locally; Vercel will still build)
  eslint: { ignoreDuringBuilds: true },
  // Uncomment if build fails on TypeScript errors you want to fix later:
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
