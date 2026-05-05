"use server"

import { revalidatePath } from "next/cache"
import { requireSession } from "@eleva/auth/server"
import {
  getExpertProfileByUserId,
  replaceBusySources,
  replaceDestinationCalendar,
} from "@eleva/db"
import {
  getAdapter,
  storeCalendarConnection,
  getAccessToken,
  disconnectCalendar,
  type CalendarProvider,
} from "@eleva/calendar"

type ActionResult = { ok: true; data?: unknown } | { ok: false; error: string }

export async function startCalendarOAuth(
  provider: CalendarProvider
): Promise<
  { ok: true; authorizationUrl: string } | { ok: false; error: string }
> {
  try {
    await requireSession("events:manage")
    const adapter = getAdapter(provider)
    const result = adapter.startOAuth()
    return { ok: true, authorizationUrl: result.authorizationUrl }
  } catch {
    return { ok: false, error: "oauth-start-failed" }
  }
}

export async function completeCalendarOAuth(
  provider: CalendarProvider,
  code: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const adapter = getAdapter(provider)
    const tokens = await adapter.exchangeCode(code)

    const calendars = await adapter.listCalendars(tokens.accessToken)
    const primaryCalendar = calendars.find((c) => c.primary)
    const accountEmail =
      primaryCalendar?.name ?? calendars[0]?.name ?? session.user.email

    await storeCalendarConnection(
      profile.orgId,
      profile.id,
      provider,
      accountEmail,
      tokens
    )

    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch {
    return { ok: false, error: "oauth-exchange-failed" }
  }
}

export async function disconnectCalendarAction(
  connectedCalendarId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    await disconnectCalendar(profile.orgId, connectedCalendarId)
    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch {
    return { ok: false, error: "disconnect-failed" }
  }
}

export async function loadSubCalendars(
  connectedCalendarId: string
): Promise<
  | { ok: true; calendars: { id: string; name: string; primary: boolean }[] }
  | { ok: false; error: string }
> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const { accessToken, provider } = await getAccessToken(
      profile.orgId,
      connectedCalendarId
    )
    const adapter = getAdapter(provider)
    const calendars = await adapter.listCalendars(accessToken)

    return {
      ok: true,
      calendars: calendars.map((c) => ({
        id: c.id,
        name: c.name,
        primary: c.primary,
      })),
    }
  } catch {
    return { ok: false, error: "load-failed" }
  }
}

export async function saveBusySources(
  connectedCalendarId: string,
  sources: { externalCalendarId: string; displayName: string }[]
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    await replaceBusySources(profile.orgId, connectedCalendarId, sources)
    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch {
    return { ok: false, error: "save-failed" }
  }
}

export async function saveDestinationCalendar(
  connectedCalendarId: string,
  externalCalendarId: string,
  displayName: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    await replaceDestinationCalendar(
      profile.orgId,
      profile.id,
      connectedCalendarId,
      externalCalendarId,
      displayName
    )
    revalidatePath("/expert/calendars")
    return { ok: true }
  } catch {
    return { ok: false, error: "save-failed" }
  }
}
