"use server"

import { z } from "zod"
import {
  DeclineExpertBookingRequestSchema,
  ListExpertBookingsQuerySchema,
} from "@eleva/api-client"
import { getAuthedApiClient, requireExpertSession } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"
import type { CalendarBooking } from "./week-view"

const BookingIdSchema = z.string().uuid()

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export async function listCalendarBookingsAction(
  from: string,
  to: string
): Promise<ActionResult<{ bookings: CalendarBooking[] }>> {
  const parsed = ListExpertBookingsQuerySchema.safeParse({ from, to })
  if (!parsed.success) {
    return { ok: false, error: "validation" }
  }

  try {
    await requireExpertSession("events:manage")
    const api = await getAuthedApiClient()
    const data = await api.expert.bookings.list(parsed.data)
    return {
      ok: true,
      data: {
        // Only what the calendar shows is sent to the browser.
        bookings: data.bookings.map((booking) => ({
          id: booking.id,
          status: booking.status,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          sessionMode: booking.sessionMode,
          memberFirstName: booking.memberFirstName,
          approvalDeadlineAt: booking.approvalDeadlineAt ?? null,
          eventTypeTitle: booking.eventTypeTitle,
          modeLabel: booking.modeLabel,
          locationName: booking.locationName,
          locationCity: booking.locationCity,
          locationCountry: booking.locationCountry,
        })),
      },
    }
  } catch (err) {
    console.error("list-calendar-bookings failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "load-failed"),
    }
  }
}

export async function acceptCalendarBookingAction(
  bookingId: string
): Promise<ActionResult<{ bookingId: string }>> {
  if (!BookingIdSchema.safeParse(bookingId).success) {
    return { ok: false, error: "validation" }
  }
  try {
    const session = await requireExpertSession("events:manage")
    const api = await getAuthedApiClient()
    const result = await api.expert.bookings.accept(bookingId)
    revalidateExpertWorkspace(session, "calendar")
    return { ok: true, data: { bookingId: result.bookingId } }
  } catch (err) {
    console.error("accept-calendar-booking failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "requestFailed", {
        conflict: "requestExpired",
      }),
    }
  }
}

export async function declineCalendarBookingAction(
  bookingId: string,
  note?: string
): Promise<ActionResult<{ bookingId: string; refundCents: number }>> {
  const parsed = DeclineExpertBookingRequestSchema.safeParse(
    note?.trim() ? { note: note.trim() } : {}
  )
  if (!parsed.success || !BookingIdSchema.safeParse(bookingId).success) {
    return { ok: false, error: "validation" }
  }
  try {
    const session = await requireExpertSession("events:manage")
    const api = await getAuthedApiClient()
    const result = await api.expert.bookings.decline(bookingId, parsed.data)
    revalidateExpertWorkspace(session, "calendar")
    return {
      ok: true,
      data: { bookingId: result.bookingId, refundCents: result.refundCents },
    }
  } catch (err) {
    console.error("decline-calendar-booking failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "requestFailed"),
    }
  }
}

export async function rotateFeedTokenAction(): Promise<
  ActionResult<{ token: string; feedUrl: string; createdAt: string }>
> {
  try {
    const session = await requireExpertSession("events:manage")
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
    const session = await requireExpertSession("events:manage")
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
