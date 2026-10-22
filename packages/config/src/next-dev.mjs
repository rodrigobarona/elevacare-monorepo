import process from "node:process"
import { URL } from "node:url"

const LOCAL_APP_PORTS = [
  ...Array.from({ length: 10 }, (_, index) => 3000 + index),
  3100,
  3102,
]
const LOCAL_ZONE_ASSET_PREFIXES = {
  app: "/_app",
  account: "/_account",
  expert: "/_expert",
  team: "/_team",
  academy: "/_academy",
  docs: "/_docs",
}

function addUrlHosts(target, value) {
  if (!value) return

  for (const raw of value.split(",")) {
    try {
      target.add(new URL(raw.trim()).host)
    } catch {
      // Invalid URL segments are ignored so optional env vars stay ergonomic.
    }
  }
}

export function resolveServerActionAllowedOrigins(env = process.env) {
  const origins = new Set(["eleva.care"])
  addUrlHosts(origins, env.APP_URL)
  addUrlHosts(origins, env.NEXT_PUBLIC_APP_URL)
  return [...origins]
}

function localDevOrigins() {
  const origins = new Set(["localhost", "127.0.0.1"])
  for (const port of LOCAL_APP_PORTS) {
    origins.add(`localhost:${port}`)
    origins.add(`127.0.0.1:${port}`)
  }
  return origins
}

export function resolveAllowedDevOrigins(env = process.env) {
  const origins = localDevOrigins()
  addUrlHosts(origins, env.NEXT_PUBLIC_APP_URL)
  addUrlHosts(origins, env.APP_URL)
  addUrlHosts(origins, env.ACCOUNT_URL)
  addUrlHosts(origins, env.NEXT_PUBLIC_ACCOUNT_URL)
  addUrlHosts(origins, env.ADMIN_URL)
  addUrlHosts(origins, env.NEXT_PUBLIC_ADMIN_URL)
  addUrlHosts(origins, env.API_URL)
  addUrlHosts(origins, env.NEXT_PUBLIC_API_URL)
  return [...origins]
}

export function resolveZoneAssetPrefix(zone, envVar, env = process.env) {
  if (env.NODE_ENV === "development") {
    return LOCAL_ZONE_ASSET_PREFIXES[zone]
  }

  return envVar || undefined
}

export function resolveGatewayStaticAssetRewrites(env = process.env) {
  if (env.NODE_ENV !== "development") return []

  return [
    {
      source: `${LOCAL_ZONE_ASSET_PREFIXES.app}/:path*`,
      destination: `${env.APP_ASSET_PREFIX || "http://localhost:3001"}${LOCAL_ZONE_ASSET_PREFIXES.app}/:path*`,
    },
    {
      source: `${LOCAL_ZONE_ASSET_PREFIXES.account}/:path*`,
      destination: `${env.ACCOUNT_ASSET_PREFIX || "http://localhost:3006"}${LOCAL_ZONE_ASSET_PREFIXES.account}/:path*`,
    },
    {
      source: `${LOCAL_ZONE_ASSET_PREFIXES.expert}/:path*`,
      destination: `${env.EXPERT_ASSET_PREFIX || "http://localhost:3003"}${LOCAL_ZONE_ASSET_PREFIXES.expert}/:path*`,
    },
    {
      source: `${LOCAL_ZONE_ASSET_PREFIXES.team}/:path*`,
      destination: `${env.TEAM_ASSET_PREFIX || "http://localhost:3004"}${LOCAL_ZONE_ASSET_PREFIXES.team}/:path*`,
    },
    {
      source: `${LOCAL_ZONE_ASSET_PREFIXES.academy}/:path*`,
      destination: `${env.ACADEMY_ASSET_PREFIX || "http://localhost:3005"}${LOCAL_ZONE_ASSET_PREFIXES.academy}/:path*`,
    },
    {
      source: `${LOCAL_ZONE_ASSET_PREFIXES.docs}/:path*`,
      destination: `${env.DOCS_ASSET_PREFIX || "http://localhost:3008"}${LOCAL_ZONE_ASSET_PREFIXES.docs}/:path*`,
    },
  ]
}

/** `images.remotePatterns` for `@eleva/media` (public Blob). */
export const ELEVA_IMAGE_REMOTE_PATTERNS = [
  { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
]

/**
 * Re-apply {@link ELEVA_IMAGE_REMOTE_PATTERNS} after third-party Next config
 * wrappers (fumadocs-mdx, next-intl, c15t). Some compose as outer functions
 * and drop `images`, which leaves `images-manifest.json` with empty
 * `remotePatterns` and `/_next/image` returns 400 ("url parameter is not allowed").
 */
export function withElevaImagesConfig(config) {
  const apply = (resolved) => ({
    ...resolved,
    images: {
      ...(resolved?.images ?? {}),
      remotePatterns: ELEVA_IMAGE_REMOTE_PATTERNS,
    },
  })

  if (typeof config === "function") {
    return async (phase, ctx) => apply(await config(phase, ctx))
  }

  return apply(config)
}
