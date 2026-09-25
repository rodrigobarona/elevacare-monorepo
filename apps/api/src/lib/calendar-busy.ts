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

type BusyInterval = { start: Date; end: Date }
type CachedInterval = { start: string; end: string }

type IntegrationBusyTarget = {
  integrationId: string
  provider: CalendarProvider
  authAccountId: string | null
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
  to: Date
): Promise<BusyInterval[]> {
  const key = cacheKey(target, from, to)
  const cached = await readCache(key)
  if (cached) return cached

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
      fetchIntegrationBusy(input.expertUserId, target, input.from, input.to)
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
    if (reason instanceof CalendarTokenError) {
      try {
        await markCalendarIntegrationExpired({
          orgId: input.expertOrgId,
          integrationId: target.integrationId,
          errorCode: reason.code,
        })
      } catch (err) {
        console.error("[calendar-busy] could not flag integration", err)
      }
    }
  }
  return { busy, degradedSources }
}

export const calendarBusyTimeProvider: BusyTimeProvider = {
  async getBusy(input) {
    const { busy } = await loadExternalBusy(input)
    return busy
  },
}
