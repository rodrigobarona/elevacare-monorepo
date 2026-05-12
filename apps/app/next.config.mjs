import { env } from "node:process"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const allowedOrigins = []
if (env.NEXT_PUBLIC_APP_URL) {
  for (const raw of env.NEXT_PUBLIC_APP_URL.split(",")) {
    try {
      allowedOrigins.push(new URL(raw.trim()).host)
    } catch {
      // invalid URL segment, skip
    }
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ADR-014 (revised): apps/app runs at the root; authenticated routes
  // (/patient, /expert, /org, /admin, /settings, /callback, /logout)
  // are individually rewritten from the gateway (apps/web).
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
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
  assetPrefix: env.APP_ASSET_PREFIX || undefined,
}

export default withNextIntl(nextConfig)
