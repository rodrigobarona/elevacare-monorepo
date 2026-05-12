import { env } from "node:process"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const allowedOrigins = []
if (env.NEXT_PUBLIC_APP_URL) {
  try {
    allowedOrigins.push(new URL(env.NEXT_PUBLIC_APP_URL).host)
  } catch {
    // invalid URL, skip
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ADR-014 (revised): apps/app runs at the root; authenticated routes
  // (/patient, /expert, /org, /admin, /settings, /callback, /logout)
  // are individually rewritten from the gateway (apps/web).
  serverActions: {
    allowedOrigins,
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
