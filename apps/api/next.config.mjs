/** @type {import('next').NextConfig} */
const nextConfig = {
  // ADR-014 (revised): apps/api runs on the api.eleva.care subdomain
  // (separate subdomain, NOT a path prefix). No basePath; no rewrite from
  // the gateway. Session cookies share the .eleva.care scope; CORS handles
  // cross-origin calls from the gateway / app zones.
  assetPrefix: process.env.API_ASSET_PREFIX || undefined,
  transpilePackages: [
    "@eleva/audit",
    "@eleva/auth",
    "@eleva/billing",
    "@eleva/config",
    "@eleva/db",
    "@eleva/encryption",
    "@eleva/observability",
    "@eleva/workflows",
  ],
}

export default nextConfig
