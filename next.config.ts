import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['exceljs', 'pg', 'bcryptjs'],
};

export default nextConfig;
