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
    "@eleva/auth",
    "@eleva/billing",
    "@eleva/config",
    "@eleva/dashboard",
    "@eleva/db",
    "@eleva/observability",
    "@eleva/ui",
  ],
  assetPrefix: resolveZoneAssetPrefix("team", env.TEAM_ASSET_PREFIX, env),
}

export default withNextIntl(nextConfig)
