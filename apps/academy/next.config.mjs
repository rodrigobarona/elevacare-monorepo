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
  skipTrailingSlashRedirect: true,
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  transpilePackages: [
    "@eleva/auth",
    "@eleva/config",
    "@eleva/dashboard",
    "@eleva/db",
    "@eleva/observability",
    "@eleva/ui",
  ],
  assetPrefix: env.ACADEMY_ASSET_PREFIX || undefined,
}

export default withNextIntl(nextConfig)
