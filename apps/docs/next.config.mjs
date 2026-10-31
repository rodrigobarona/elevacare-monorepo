import { withElevaConsentManifest } from "@eleva/consent/with-consent-manifest"
import { createMDX } from "fumadocs-mdx/next"
import { env } from "node:process"
import {
  elevaImageRemotePatterns,
  resolveZoneAssetPrefix,
} from "@eleva/config/next-dev"

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/docs",
  transpilePackages: [
    "@eleva/content",
    "@eleva/consent",
    "@eleva/media",
    "@eleva/site-chrome",
    "@eleva/ui",
    "c15t",
    "@c15t/core",
    "@c15t/nextjs",
    "@c15t/react",
  ],
  images: { remotePatterns: elevaImageRemotePatterns() },
  assetPrefix: resolveZoneAssetPrefix("docs", env.DOCS_ASSET_PREFIX, env),
  /**
   * Default-locale (English) help URLs are unprefixed (`/docs/members/...`,
   * the target of the legacy `/help/*` redirects); the `[locale]` route tree
   * serves them from `/en`. pt/es stay prefixed.
   */
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/en" },
        {
          source: "/:portal(members|experts|clinics)",
          destination: "/en/:portal",
        },
        {
          source: "/:portal(members|experts|clinics)/:path*",
          destination: "/en/:portal/:path*",
        },
      ],
    }
  },
}

export default withElevaConsentManifest(withMDX(nextConfig))
