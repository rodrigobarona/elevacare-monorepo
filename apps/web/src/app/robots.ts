import type { MetadataRoute } from "next"
import { resolveGatewayUrl } from "@eleva/config/env"

export default function robots(): MetadataRoute.Robots {
  const origin = resolveGatewayUrl().replace(/\/+$/, "")
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${origin}/sitemap.xml`,
  }
}
