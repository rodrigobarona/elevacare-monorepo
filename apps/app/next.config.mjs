/** @type {import('next').NextConfig} */
const nextConfig = {
  // ADR-014 (revised): apps/app runs at the root; authenticated routes
  // (/patient, /expert, /org, /admin, /settings, /callback, /logout)
  // are individually rewritten from the gateway (apps/web).
  transpilePackages: ['@eleva/ui'],
  assetPrefix: process.env.APP_ASSET_PREFIX || undefined,
};

export default nextConfig;
