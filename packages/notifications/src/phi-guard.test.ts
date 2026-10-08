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
const STARTS_AT = "2026-09-22T10:00:00.000Z"

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
    endsAt: new Date("2026-09-22T10:50:00.000Z"),
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
              previousStartsAt: "2026-09-20T10:00:00.000Z",
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
