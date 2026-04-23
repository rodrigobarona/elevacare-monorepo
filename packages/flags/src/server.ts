import { cache } from "react"
import { getFlag } from "./client"
import type { FlagName } from "./catalog"

/**
 * Server-side flag lookup cached per-request via React.cache (Next 16
 * App Router). Call from Server Components, Route Handlers, and Server
 * Actions.
 */
export const flag = cache(async (name: FlagName) => getFlag(name))
