import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: include workspace root for correct file tracing
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
