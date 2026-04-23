import { get } from "@vercel/edge-config"
import { env } from "@eleva/config/env"
import { FLAG_CATALOG, type FlagName } from "./catalog"

/**
 * Read a flag value. Reads Edge Config first; falls back to the
 * catalog default when Edge Config is unreachable or returns undefined.
 * Silently falls back on any Edge Config error (logged upstream via
 * beforeSend redaction; we never page on flag reads).
 */
export async function getFlag(name: FlagName): Promise<boolean> {
  const fallback = FLAG_CATALOG[name].default
  if (!env().EDGE_CONFIG) return fallback
  try {
    const value = await get<boolean>(name)
    if (typeof value !== "boolean") return fallback
    return value
  } catch {
    return fallback
  }
}

/**
 * Bootstrap helper for client components: returns a plain object of
 * every flag's current value, resolved from Edge Config with catalog
 * fallback. Emitted once per request to the client.
 */
export async function getAllFlags(): Promise<Record<FlagName, boolean>> {
  const out = {} as Record<FlagName, boolean>
  const names = Object.keys(FLAG_CATALOG) as FlagName[]
  await Promise.all(
    names.map(async (name) => {
      out[name] = await getFlag(name)
    })
  )
  return out
}
