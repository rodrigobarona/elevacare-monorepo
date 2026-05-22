import { env } from "node:process"
import { resolveZoneAssetPrefix } from "@eleva/config/next-dev"

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/docs",
  transpilePackages: ["@eleva/ui"],
  assetPrefix: resolveZoneAssetPrefix("docs", env.DOCS_ASSET_PREFIX, env),
}

export default nextConfig
