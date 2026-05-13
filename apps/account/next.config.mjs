import { env } from "node:process"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const allowedOrigins = []
const accountUrl = env.ACCOUNT_URL || env.NEXT_PUBLIC_ACCOUNT_URL
if (accountUrl) {
  for (const raw of accountUrl.split(",")) {
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
    "@eleva/storage",
    "@eleva/ui",
  ],
}

export default withNextIntl(nextConfig)
