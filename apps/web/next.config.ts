import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Pin the standalone trace root to the monorepo root so the build always emits
  // `.next/standalone/apps/web/server.js` (the path the Dockerfile runs). Without
  // this, Next auto-guesses the root and the server.js path can drift.
  outputFileTracingRoot: path.join(process.cwd(), '..', '..'),
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
