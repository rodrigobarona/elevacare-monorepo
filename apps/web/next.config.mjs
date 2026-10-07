import { withBotId } from "botid/next/config"
import createNextIntlPlugin from "next-intl/plugin"
import {
  resolveAllowedDevOrigins,
  resolveGatewayStaticAssetRewrites,
} from "@eleva/config/next-dev"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

/**
 * AUD-017: same-origin `/api/*` → apps/api so BotID can sign booking-funnel
 * requests (the BotID client skips cross-origin calls). Off unless
 * NEXT_PUBLIC_BOTID_SAME_ORIGIN_API=true; staging-only until the per-IP rate
 * limit is proven independent behind the rewrite.
 */
function resolveSameOriginApiRewrites() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  if (process.env.NEXT_PUBLIC_BOTID_SAME_ORIGIN_API !== "true" || !apiUrl) {
    return []
  }
  return [
    {
      source: "/api/:path*",
      destination: `${apiUrl.replace(/\/$/, "")}/:path*`,
    },
  ]
}

/**
 * Gateway zone routing for the marketing app.
 *
 * Routing decisions live in `src/proxy.ts` (the single source of truth)
 * so they can use dynamic context like the session cookie, org slug,
 * and locale fallbacks. The proxy runs for every matching request BEFORE
 * Next.js applies any `rewrites()` in this config, so duplicating those
 * rewrites here would be dead code that adds cognitive overhead without
 * affecting routing.
 *
 * If you need to add a new internal zone, update:
 *   - packages/config/src/routing.ts   (declarative path lists)
 *   - apps/web/src/proxy.ts            (resolveOrigin dispatch)
 * and that's it.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: resolveAllowedDevOrigins(),
  /**
   * The gateway owns trailing-slash policy for the entire domain.
   *
   * `skipTrailingSlashRedirect: true` disables Next.js' built-in 308
   * trailing-slash redirect so the proxy (`src/proxy.ts`) and any
   * future Vercel-level rewrites can implement zone-specific behavior
   * without conflicting with the framework default. All satellite
   * apps (apps/account, apps/app, apps/admin, etc.) also set this to
   * `true` so behavior is consistent across the multi-zone surface.
   *
   * See packages/auth/src/proxy.ts and apps/web/src/proxy.ts for the
   * dispatch logic that handles canonical URLs explicitly.
   */
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return {
      beforeFiles: [
        ...resolveGatewayStaticAssetRewrites(),
        ...resolveSameOriginApiRewrites(),
      ],
    }
  },
  transpilePackages: [
    "@eleva/auth",
    "@eleva/billing",
    "@eleva/calendar",
    "@eleva/config",
    "@eleva/db",
    "@eleva/ui",
  ],
}

export default withBotId(withNextIntl(nextConfig))
