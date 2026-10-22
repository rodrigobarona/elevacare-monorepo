import { C15T_TRANSPILE_PACKAGES } from "@eleva/consent/c15t-transpile-packages"
import { withElevaConsentManifest } from "@eleva/consent/with-consent-manifest"
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
    "@eleva/config",
    "@eleva/dashboard",
    "@eleva/db",
    "@eleva/observability",
    "@eleva/ui",
    ...C15T_TRANSPILE_PACKAGES,
  ],
  assetPrefix: resolveZoneAssetPrefix("academy", env.ACADEMY_ASSET_PREFIX, env),
}

export default withElevaConsentManifest(withNextIntl(nextConfig))
