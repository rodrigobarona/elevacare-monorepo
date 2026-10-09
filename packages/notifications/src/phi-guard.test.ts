import { describe, expect, it, vi } from "vitest"
import type { LoadedBooking } from "./send-booking-notification"

vi.mock("@eleva/db", () => ({
  auth: { user: {} },
  main: { bookings: {}, eventTypes: {} },
  withPlatformAdminContext: vi.fn(),
}))
vi.mock("@eleva/video/join-grant", () => ({
  mintJoinGrant: vi.fn(async ({ role }: { role: string }) => `grant-${role}`),
  sessionJoinPath: (bookingId: string, grant: string) =>
    `/join/${bookingId}?g=${grant}`,
  joinGrantExpUnix: (endsAt: Date) =>
    Math.floor((endsAt.getTime() + 30 * 60 * 1000) / 1000),
}))
vi.mock("./send-notification", () => ({
  sendNotification: vi.fn(),
}))

import { sendBookingNotification } from "./send-booking-notification"

/**
 * Subjects, SMS and in-app bodies are visible on lock screens and in inbox
 * previews (ADR-006, Phase 08 acceptance: no PHI in subjects/SMS). The
 * service name can reveal a condition and the surname identifies the
 * member, so both may only appear inside the email body.
 */
const SERVICE = "SentinelConditionTherapy"
const SURNAME = "Sentinelsurname"
const STARTS_AT_DATE = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
STARTS_AT_DATE.setUTCSeconds(0, 0)
const STARTS_AT = STARTS_AT_DATE.toISOString()

const KINDS = [
  { kind: "booking.confirmed", status: "confirmed" },
  { kind: "booking.rescheduled", status: "rescheduled" },
  { kind: "booking.cancelled", status: "cancelled" },
  { kind: "booking.reminder_24h", status: "confirmed" },
  { kind: "booking.reminder_1h", status: "confirmed" },
] as const

const LOCALES = ["en", "pt", "es"] as const

function booking(
  status: LoadedBooking["status"],
  locale: (typeof LOCALES)[number]
): LoadedBooking {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    orgId: "00000000-0000-4000-8000-000000000001",
    orgSlug: "acme",
    status,
    startsAt: new Date(STARTS_AT),
    endsAt: new Date(STARTS_AT_DATE.getTime() + 50 * 60 * 1000),
    timezone: "Europe/Lisbon",
    sessionMode: "online",
    bookedLocale: locale,
    memberUserId: "00000000-0000-4000-8000-000000000003",
    memberEmail: "member@example.com",
    memberName: `Ada ${SURNAME}`,
    guestEmail: null,
    guestName: null,
    expertUserId: "00000000-0000-4000-8000-000000000004",
    expertEmail: "expert@example.com",
    expertName: "Ana Silva",
    eventTypeName: { en: SERVICE, pt: SERVICE, es: SERVICE },
    scheduleRevision: 1,
    cancellationPolicy: "moderate",
    currency: "EUR",
    priceCents: 6000,
    guestPhone: null,
    memberPhone: null,
    language: locale,
    memberCountry: "PT",
    locationName: null,
  }
}

describe("notification PHI guard", () => {
  for (const { kind, status } of KINDS) {
    for (const locale of LOCALES) {
      it(`keeps ${kind} (${locale}) subjects and SMS bodies free of PHI`, async () => {
        const send = vi.fn().mockResolvedValue({ kind, deliveries: [] })
        await sendBookingNotification(
          {
            id: `evt-${kind}-${locale}`,
            type: kind,
            orgId: "00000000-0000-4000-8000-000000000001",
            payload: {
              bookingId: "00000000-0000-4000-8000-000000000002",
              startsAt: STARTS_AT,
              occurredAt: "2026-09-21T15:00:00.000Z",
              previousStartsAt: new Date(
                STARTS_AT_DATE.getTime() - 2 * 24 * 60 * 60 * 1000
              ).toISOString(),
              scheduleRevision: 1,
            },
          },
          { loadBooking: async () => booking(status, locale), send }
        )

        expect(send).toHaveBeenCalledTimes(2)
        for (const [input] of send.mock.calls as Array<
          [
            {
              ctx: {
                subject: string
                body: string
                title: string
                html: string
              }
            },
          ]
        >) {
          expect(input.ctx.html).toContain(SERVICE)
          for (const field of [
            input.ctx.subject,
            input.ctx.body,
            input.ctx.title,
          ]) {
            expect(field).not.toContain(SERVICE)
            expect(field).not.toContain(SURNAME)
          }
        }
      })
    }
  }
})
