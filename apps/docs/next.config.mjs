import { env } from "node:process"
import {
  ELEVA_IMAGE_REMOTE_PATTERNS,
  resolveZoneAssetPrefix,
} from "@eleva/config/next-dev"

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/docs",
  transpilePackages: ["@eleva/media", "@eleva/ui"],
  images: { remotePatterns: ELEVA_IMAGE_REMOTE_PATTERNS },
  assetPrefix: resolveZoneAssetPrefix("docs", env.DOCS_ASSET_PREFIX, env),
}

export default nextConfig
