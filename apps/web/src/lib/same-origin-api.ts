/**
 * Same-origin prefix rewritten to apps/api in `next.config.mjs`. BotID only
 * signs same-origin browser requests, so the funnel must not call
 * api.eleva.care directly when BotID is on.
 */
export const SAME_ORIGIN_API_PREFIX = "/api"

export function isSameOriginApiEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BOTID_SAME_ORIGIN_API === "true"
}
