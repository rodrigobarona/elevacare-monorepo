import { env } from "node:process"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const allowedOrigins = []
const adminUrl = env.ADMIN_URL || env.NEXT_PUBLIC_ADMIN_URL
if (adminUrl) {
  for (const raw of adminUrl.split(",")) {
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
    "@eleva/billing",
    "@eleva/config",
    "@eleva/db",
    "@eleva/observability",
    "@eleva/ui",
  ],
}

export default withNextIntl(nextConfig)
