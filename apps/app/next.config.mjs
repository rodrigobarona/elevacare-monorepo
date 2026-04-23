import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ADR-014 (revised): apps/app runs at the root; authenticated routes
  // (/patient, /expert, /org, /admin, /settings, /callback, /logout)
  // are individually rewritten from the gateway (apps/web).
  transpilePackages: [
    "@eleva/audit",
    "@eleva/auth",
    "@eleva/config",
    "@eleva/db",
    "@eleva/encryption",
    "@eleva/flags",
    "@eleva/observability",
    "@eleva/ui",
    "@eleva/workflows",
  ],
  assetPrefix: process.env.APP_ASSET_PREFIX || undefined,
}

export default withNextIntl(nextConfig)
