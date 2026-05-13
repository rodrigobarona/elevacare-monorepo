import { env } from "node:process"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

const appOrigin = env.APP_ASSET_PREFIX || "http://localhost:3001"
const expertOrigin = env.EXPERT_ASSET_PREFIX || "http://localhost:3002"
const teamOrigin = env.TEAM_ASSET_PREFIX || "http://localhost:3004"
const academyOrigin = env.ACADEMY_ASSET_PREFIX || "http://localhost:3005"

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
        // Member app fixed paths
        ...rootSegments.map((seg) => ({
          source: `/${seg}/:path*`,
          destination: `${appOrigin}/${seg}/:path*`,
        })),
        ...standalonePaths.map((path) => ({
          source: `/${path}`,
          destination: `${appOrigin}/${path}`,
        })),
      ],
    }
  },
}

export default withNextIntl(nextConfig)
