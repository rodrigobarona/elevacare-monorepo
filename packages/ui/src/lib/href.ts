/**
 * Anything the Next.js App Router must not handle: `scheme:` hrefs (absolute URLs
 * from `gatewayUrl()`, `mailto:`, `tel:`) and protocol-relative `//host/path`.
 */
const EXTERNAL_HREF_PATTERN = /^([a-z][a-z0-9+.-]*:|\/\/)/i

/**
 * Schemes we are willing to hand to `window.location.assign`. Every React Aria
 * pressable with an `href` flows through `navigate`, so an href built from stored
 * or member-supplied data must never reach `javascript:` / `data:` / `blob:`.
 */
const SAFE_EXTERNAL_HREF_PATTERN = /^(https?:|mailto:|tel:|sms:|\/\/)/i

export type HrefClassification =
  | { kind: "internal"; href: string }
  | { kind: "external"; href: string }
  | { kind: "blocked"; href: string }

/**
 * Decides how a React Aria `href` must be navigated. The href is trimmed first:
 * a leading newline or space would otherwise slip a `javascript:` URL past the
 * scheme check and into `router.push`, which Next.js executes in page context.
 */
export function classifyHref(rawHref: string): HrefClassification {
  const href = rawHref.trim()
  if (!EXTERNAL_HREF_PATTERN.test(href)) {
    return { kind: "internal", href }
  }
  if (SAFE_EXTERNAL_HREF_PATTERN.test(href)) {
    return { kind: "external", href }
  }
  return { kind: "blocked", href }
}
