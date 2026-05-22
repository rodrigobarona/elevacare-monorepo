import { env } from "node:process"
import createNextIntlPlugin from "next-intl/plugin"
import {
  resolveAllowedDevOrigins,
  resolveServerActionAllowedOrigins,
  resolveZoneAssetPrefix,
} from "@eleva/config/next-dev"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const allowedOrigins = resolveServerActionAllowedOrigins(env)
const allowedDevOrigins = resolveAllowedDevOrigins(env)

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins,
  // Org-slug routes under /[orgSlug]/* are rewritten from the gateway (apps/web).
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
  assetPrefix: resolveZoneAssetPrefix("app", env.APP_ASSET_PREFIX, env),
}

export default withNextIntl(nextConfig)
