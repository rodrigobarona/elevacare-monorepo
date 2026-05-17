import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

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
  transpilePackages: ["@eleva/auth", "@eleva/config", "@eleva/db", "@eleva/ui"],
}

export default withNextIntl(nextConfig)
