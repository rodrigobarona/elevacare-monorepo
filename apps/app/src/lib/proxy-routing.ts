import { ACCOUNT_STANDALONE_PATHS } from "@eleva/config/routing"

const AUTH_FLOW_PATHS = ACCOUNT_STANDALONE_PATHS.map((p) => `/${p}`)

/**
 * Paths that the member app serves publicly (marketing-shaped routes
 * + the Better Auth login flow paths): the proxy skips the
 * unauthenticated redirect on them.
 */
export const MEMBER_APP_UNAUTHENTICATED_PATHS = [
  "/",
  "/home",
  "/about",
  "/legal/:path*",
  "/join/:path*",
  ...AUTH_FLOW_PATHS,
] as const
