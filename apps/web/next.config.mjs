/**
 * Gateway config for `eleva.care`.
 *
 * Multi-zone rewrites per ADR-014 (revised):
 * - apps/app runs at the root; authenticated routes (/patient, /expert,
 *   /org, /admin, /settings, /callback, /logout, /signin, /signup) are
 *   rewritten here.
 * - apps/docs is served under /docs/*.
 * - apps/api is NOT rewritten here — it runs on api.eleva.care (separate
 *   subdomain), reached cross-origin with credentials.
 *
 * @type {import('next').NextConfig}
 */
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const APP_URL = process.env.APP_URL || "http://localhost:3001"
const DOCS_URL = process.env.DOCS_URL || "http://localhost:3003"

const APP_ROOT_SEGMENTS = ["patient", "expert", "org", "admin", "settings"]
const APP_STANDALONE_PATHS = ["callback", "logout", "signin", "signup"]

const appRewrites = [
  ...APP_ROOT_SEGMENTS.flatMap((seg) => [
    { source: `/${seg}`, destination: `${APP_URL}/${seg}` },
    { source: `/${seg}/:path*`, destination: `${APP_URL}/${seg}/:path*` },
  ]),
  ...APP_STANDALONE_PATHS.map((p) => ({
    source: `/${p}`,
    destination: `${APP_URL}/${p}`,
  })),
]

const docsRewrites = [
  { source: "/docs", destination: `${DOCS_URL}/docs` },
  { source: "/docs/:path*", destination: `${DOCS_URL}/docs/:path*` },
]

const nextConfig = {
  transpilePackages: [
    "@eleva/audit",
    "@eleva/auth",
    "@eleva/billing",
    "@eleva/config",
    "@eleva/db",
    "@eleva/observability",
    "@eleva/ui",
  ],
  async rewrites() {
    return {
      afterFiles: [...appRewrites, ...docsRewrites],
    }
  },
}

export default withNextIntl(nextConfig)
