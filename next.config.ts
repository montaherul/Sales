import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['exceljs', 'pg', 'bcryptjs'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
