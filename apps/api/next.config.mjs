/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/api',
  assetPrefix: process.env.API_ASSET_PREFIX || undefined,
};

export default nextConfig;
