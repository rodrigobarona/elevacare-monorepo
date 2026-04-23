/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/docs',
  transpilePackages: ['@eleva/ui'],
  assetPrefix: process.env.DOCS_ASSET_PREFIX || undefined,
};

export default nextConfig;
