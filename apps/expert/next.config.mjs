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
  skipTrailingSlashRedirect: true,
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
  transpilePackages: [
    "@eleva/accounting",
    "@eleva/auth",
    "@eleva/billing",
    "@eleva/calendar",
    "@eleva/config",
    "@eleva/dashboard",
    "@eleva/db",
    "@eleva/integrations",
    "@eleva/observability",
    "@eleva/storage",
    "@eleva/ui",
  ],
  assetPrefix: resolveZoneAssetPrefix("expert", env.EXPERT_ASSET_PREFIX, env),
}

export default withNextIntl(nextConfig)
