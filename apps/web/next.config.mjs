import { env } from "node:process"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const appOrigin = env.APP_ASSET_PREFIX || "http://localhost:3001"
const expertOrigin = env.EXPERT_ASSET_PREFIX || "http://localhost:3003"
const teamOrigin = env.TEAM_ASSET_PREFIX || "http://localhost:3004"
const academyOrigin = env.ACADEMY_ASSET_PREFIX || "http://localhost:3005"
const accountOrigin = env.ACCOUNT_ASSET_PREFIX || "http://localhost:3006"

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@eleva/auth", "@eleva/config", "@eleva/db", "@eleva/ui"],

  async rewrites() {
    const accountSegments = ["onboarding", "account"]
    const accountStandalone = [
      "dashboard",
      "callback",
      "logout",
      "signin",
      "signup",
    ]

    const appSegments = ["admin"]

    return {
      beforeFiles: [
        // Expert app (org-scoped)
        {
          source: "/:orgSlug/expert/:path*",
          destination: `${expertOrigin}/:orgSlug/expert/:path*`,
        },
        // Team app (org-scoped)
        {
          source: "/:orgSlug/team/:path*",
          destination: `${teamOrigin}/:orgSlug/team/:path*`,
        },
        // Academy app (org-scoped, future)
        {
          source: "/:orgSlug/academy/:path*",
          destination: `${academyOrigin}/:orgSlug/academy/:path*`,
        },
        // Account app (auth, onboarding, settings)
        ...accountSegments.map((seg) => ({
          source: `/${seg}/:path*`,
          destination: `${accountOrigin}/${seg}/:path*`,
        })),
        ...accountStandalone.map((path) => ({
          source: `/${path}`,
          destination: `${accountOrigin}/${path}`,
        })),
        // Member app fixed paths
        ...appSegments.map((seg) => ({
          source: `/${seg}/:path*`,
          destination: `${appOrigin}/${seg}/:path*`,
        })),
      ],
    }
  },
}

export default withNextIntl(nextConfig)
