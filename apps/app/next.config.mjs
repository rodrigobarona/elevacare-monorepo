import { env } from "node:process"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const allowedOrigins = ["eleva.care"]
for (const urlVar of [env.APP_URL, env.NEXT_PUBLIC_APP_URL]) {
  if (urlVar) {
    for (const raw of urlVar.split(",")) {
      try {
        allowedOrigins.push(new URL(raw.trim()).host)
      } catch {
        // invalid URL segment, skip
      }
    }
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ADR-014 (revised): apps/app runs at the root; authenticated routes
  // (/dashboard, /expert, /org, /admin, /settings, /callback, /logout)
  // are individually rewritten from the gateway (apps/web).
  skipTrailingSlashRedirect: true,
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  transpilePackages: [
    "@eleva/audit",
    "@eleva/auth",
    "@eleva/config",
    "@eleva/dashboard",
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
