import { env } from "node:process"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const appAssetPrefix = env.APP_ASSET_PREFIX || "http://localhost:3001"

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@eleva/auth", "@eleva/config", "@eleva/db", "@eleva/ui"],

  async rewrites() {
    const rootSegments = ["onboarding", "account", "admin"]
    const standalonePaths = [
      "auth-redirect",
      "callback",
      "logout",
      "signin",
      "signup",
    ]

    return {
      beforeFiles: [
        ...rootSegments.map((seg) => ({
          source: `/${seg}/:path*`,
          destination: `${appAssetPrefix}/${seg}/:path*`,
        })),
        ...standalonePaths.map((path) => ({
          source: `/${path}`,
          destination: `${appAssetPrefix}/${path}`,
        })),
      ],
    }
  },
}

export default withNextIntl(nextConfig)
