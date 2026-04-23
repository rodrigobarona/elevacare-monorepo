/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/app',
  transpilePackages: ['@eleva/ui'],
  assetPrefix: process.env.APP_ASSET_PREFIX || undefined,
};

export default nextConfig;
