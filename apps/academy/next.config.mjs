import { env } from "node:process"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const allowedOrigins = []
const appUrlRaw = env.ACADEMY_URL || env.NEXT_PUBLIC_ACADEMY_URL
if (appUrlRaw) {
  for (const raw of appUrlRaw.split(",")) {
    try {
      allowedOrigins.push(new URL(raw.trim()).host)
    } catch {
      // invalid URL segment, skip
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
    "@eleva/db",
    "@eleva/observability",
    "@eleva/ui",
  ],
  assetPrefix: env.ACADEMY_ASSET_PREFIX || undefined,
}

export default withNextIntl(nextConfig)
