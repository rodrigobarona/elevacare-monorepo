import { withElevaConsentManifest } from "@eleva/consent/with-consent-manifest"
import { createMDX } from "fumadocs-mdx/next"
import { env } from "node:process"
import {
  ELEVA_IMAGE_REMOTE_PATTERNS,
  resolveZoneAssetPrefix,
  withElevaImagesConfig,
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
  images: { remotePatterns: ELEVA_IMAGE_REMOTE_PATTERNS },
  assetPrefix: resolveZoneAssetPrefix("docs", env.DOCS_ASSET_PREFIX, env),
}

export default withElevaImagesConfig(
  withElevaConsentManifest(withMDX(nextConfig))
)
