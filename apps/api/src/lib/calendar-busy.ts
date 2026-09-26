import {
  getProviderAccessToken,
  markCalendarIntegrationExpired,
} from "@eleva/auth"
import {
  calendarProviderForSlug,
  CalendarTokenError,
  createCredentialManager,
  getAdapter,
  requireAuthAccountId,
  type CalendarProvider,
} from "@eleva/calendar"
import { listBusySourcesForExpert, listCalendarIntegrations } from "@eleva/db"
import type { BusyTimeProvider } from "@eleva/scheduling"
import { getBookingRedis } from "@/lib/booking-redis"

const credentials = createCredentialManager({ getProviderAccessToken })

export const CALENDAR_BUSY_CACHE_TTL_SECONDS = 5 * 60

// Codes that prove the grant is gone; `token_unavailable` may be transient.
const CONFIRMED_REAUTH_CODES = new Set([
  "needs_reauthorization",
  "not_installed",
  "account_not_found",
])

/** A hold cannot be placed while a connected calendar could not be checked. */
export class CalendarBusyUnavailableError extends Error {
  readonly degradedSources: string[]
  constructor(degradedSources: string[]) {
    super("External calendar busy times unavailable")
    this.name = "CalendarBusyUnavailableError"
    this.degradedSources = degradedSources
  }
}

type BusyInterval = { start: Date; end: Date }
type CachedInterval = { start: string; end: string }

type IntegrationBusyTarget = {
  integrationId: string
  provider: CalendarProvider
  authAccountId: string | null
  connectedAt: Date | null
  calendarIds: string[]
}

// Sorted calendar ids are part of the key, so toggling a busy source
// changes the key instead of serving a stale merge.
function cacheKey(target: IntegrationBusyTarget, from: Date, to: Date): string {
  const calendars = [...target.calendarIds].sort().join(",")
  return `calendar-busy:v1:${target.integrationId}:${calendars}:${from.toISOString()}:${to.toISOString()}`
}

async function readCache(key: string): Promise<BusyInterval[] | null> {
  const redis = getBookingRedis()
  if (!redis) return null
  try {
    const cached = await redis.get<CachedInterval[]>(key)
    return cached
      ? cached.map((i) => ({ start: new Date(i.start), end: new Date(i.end) }))
      : null
  } catch {
    return null
  }
}

async function writeCache(key: string, busy: BusyInterval[]): Promise<void> {
  const redis = getBookingRedis()
  if (!redis) return
  try {
    await redis.set(
      key,
      busy.map((i) => ({
        start: i.start.toISOString(),
        end: i.end.toISOString(),
      })),
      { ex: CALENDAR_BUSY_CACHE_TTL_SECONDS }
    )
  } catch {
    // Cache is best-effort; the next request refetches.
  }
}

async function fetchIntegrationBusy(
  userId: string,
  target: IntegrationBusyTarget,
  from: Date,
  to: Date,
  fresh: boolean
): Promise<BusyInterval[]> {
  const key = cacheKey(target, from, to)
  if (!fresh) {
    const cached = await readCache(key)
    if (cached) return cached
  }

  const accessToken = await credentials.getCalendarToken(
    userId,
    target.provider,
    requireAuthAccountId(target.authAccountId)
  )
  const busy = await getAdapter(target.provider).getFreeBusy(
    accessToken,
    target.calendarIds,
    from,
    to
  )
  await writeCache(key, busy)
  return busy
}

export async function loadExternalBusy(input: {
  expertOrgId: string
  expertProfileId: string
  expertUserId: string
  from: Date
  to: Date
  /** Skip the cache read (hold-time recheck); the result still refreshes it. */
  fresh?: boolean
}): Promise<{ busy: BusyInterval[]; degradedSources: string[] }> {
  const [integrations, sources] = await Promise.all([
    listCalendarIntegrations(input.expertOrgId, input.expertProfileId),
    listBusySourcesForExpert(input.expertOrgId, input.expertProfileId),
  ])

  const targets = new Map<string, IntegrationBusyTarget>()
  for (const integration of integrations) {
    const provider = calendarProviderForSlug(integration.slug)
    if (!provider) continue
    targets.set(integration.id, {
      integrationId: integration.id,
      provider,
      authAccountId: integration.authAccountId,
      connectedAt: integration.connectedAt,
      calendarIds: [],
    })
  }
  for (const source of sources) {
    if (!source.enabled) continue
    targets
      .get(source.expertIntegrationId)
      ?.calendarIds.push(source.externalCalendarId)
  }
  const active = [...targets.values()].filter((t) => t.calendarIds.length > 0)

  const settled = await Promise.allSettled(
    active.map((target) =>
      fetchIntegrationBusy(
        input.expertUserId,
        target,
        input.from,
        input.to,
        input.fresh ?? false
      )
    )
  )

  const busy: BusyInterval[] = []
  const degradedSources: string[] = []
  for (const [index, result] of settled.entries()) {
    const target = active[index]!
    if (result.status === "fulfilled") {
      busy.push(...result.value)
      continue
    }
    degradedSources.push(target.integrationId)
    const reason = result.reason
    console.warn("[calendar-busy] busy lookup failed", {
      integrationId: target.integrationId,
      provider: target.provider,
      error: reason instanceof Error ? reason.name : "unknown",
    })
    if (
      reason instanceof CalendarTokenError &&
      CONFIRMED_REAUTH_CODES.has(reason.code)
    ) {
      try {
        await markCalendarIntegrationExpired({
          orgId: input.expertOrgId,
          integrationId: target.integrationId,
          errorCode: reason.code,
          observedConnectedAt: target.connectedAt,
        })
      } catch (err) {
        console.error("[calendar-busy] could not flag integration", err)
      }
    }
  }
  return { busy, degradedSources }
}

/** Public slot display: cached, and a failed calendar degrades to its other busy data. */
export const calendarBusyTimeProvider: BusyTimeProvider = {
  async getBusy(input) {
    const { busy } = await loadExternalBusy(input)
    return busy
  },
}

/** Hold-time recheck: live provider data, and fails closed on any gap. */
export const holdCalendarBusyTimeProvider: BusyTimeProvider = {
  async getBusy(input) {
    const { busy, degradedSources } = await loadExternalBusy({
      ...input,
      fresh: true,
    })
    if (degradedSources.length > 0) {
      throw new CalendarBusyUnavailableError(degradedSources)
    }
    return busy
  },
}
