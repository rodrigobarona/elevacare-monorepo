import { resolveGatewayUrl } from "@eleva/config/env"

/** Absolute gateway URL for cross-zone routes (multi-zone dev + prod). */
export function gatewayUrl(path: string): string {
  const base = resolveGatewayUrl().replace(/\/$/, "")
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalizedPath}`
}
