"use server"

import { requireSession } from "@eleva/auth/server"
import { ListExpertBookingsQuerySchema } from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export async function listCalendarBookingsAction(
  from: string,
  to: string
): Promise<
  ActionResult<{
    bookings: {
      id: string
      status: string
      startsAt: string
      endsAt: string
      timezone: string
      sessionMode: "online" | "in_person" | "phone"
      memberFirstName: string | null
      eventTypeTitle: { en: string; pt?: string; es?: string }
      eventTypeSlug: string
      modeLabel: { en: string; pt?: string; es?: string } | null
      locationName: string | null
      locationCity: string | null
      locationCountry: string | null
      locationAddress: string | null
    }[]
  }>
> {
  const parsed = ListExpertBookingsQuerySchema.safeParse({ from, to })
  if (!parsed.success) {
    return { ok: false, error: "validation" }
  }

  try {
    await requireSession("events:manage")
    const api = await getAuthedApiClient()
    const data = await api.expert.bookings.list(parsed.data)
    return { ok: true, data }
  } catch (err) {
    console.error("list-calendar-bookings failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "load-failed"),
    }
  }
}

export async function rotateFeedTokenAction(): Promise<
  ActionResult<{ token: string; feedUrl: string; createdAt: string }>
> {
  try {
    const session = await requireSession("events:manage")
    const api = await getAuthedApiClient()
    const result = await api.expert.calendar.rotateFeedToken()
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002"
    const feedUrl = `${apiBase.replace(/\/$/, "")}/calendar/feed/${result.token}.ics`
    revalidateExpertWorkspace(session, "calendar")
    return {
      ok: true,
      data: {
        token: result.token,
        feedUrl,
        createdAt: result.createdAt,
      },
    }
  } catch (err) {
    console.error("rotate-feed-token failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "rotate-failed"),
    }
  }
}

export async function revokeFeedTokenAction(): Promise<
  ActionResult<{ ok: true }>
> {
  try {
    const session = await requireSession("events:manage")
    const api = await getAuthedApiClient()
    await api.expert.calendar.revokeFeedToken()
    revalidateExpertWorkspace(session, "calendar")
    return { ok: true, data: { ok: true } }
  } catch (err) {
    console.error("revoke-feed-token failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "revoke-failed", {
        notFound: "no-token",
      }),
    }
  }
}
