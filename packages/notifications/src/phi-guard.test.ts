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
 * member, so both may only appear inside the email body. Calendar invites
 * sync to shared and work calendars, so the ICS gets the same rule, and it
 * never carries the member's phone number in any form.
 */
const SERVICE = "SentinelConditionTherapy"
const SURNAME = "Sentinelsurname"
const PHONE = "+351912345678"
const PHONE_FRAGMENTS = [PHONE, "912345678", "··· 678"]
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

const MODES = ["online", "phone", "in_person"] as const

const CLINIC: NonNullable<LoadedBooking["location"]> = {
  name: "Clínica Chiado",
  address: "Rua Garrett 10",
  line2: null,
  postalCode: "1200-204",
  city: "Lisboa",
  latitude: null,
  longitude: null,
  instructions: { en: "Ring the second bell." },
}

function booking(
  status: LoadedBooking["status"],
  locale: (typeof LOCALES)[number],
  mode: (typeof MODES)[number]
): LoadedBooking {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    orgId: "00000000-0000-4000-8000-000000000001",
    orgSlug: "acme",
    status,
    startsAt: new Date(STARTS_AT),
    endsAt: new Date(STARTS_AT_DATE.getTime() + 50 * 60 * 1000),
    timezone: "Europe/Lisbon",
    sessionMode: mode,
    bookedLocale: locale,
    memberUserId: "00000000-0000-4000-8000-000000000003",
    memberEmail: "member@example.com",
    memberName: `Ada ${SURNAME}`,
    memberEmailVerified: true,
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
    memberPhone: PHONE,
    language: locale,
    memberCountry: "PT",
    location: mode === "in_person" ? CLINIC : null,
  }
}

describe("notification PHI guard", () => {
  for (const { kind, status } of KINDS) {
    for (const locale of LOCALES) {
      for (const mode of MODES) {
        it(`keeps ${kind} (${locale}, ${mode}) subjects, SMS and ICS free of PHI`, async () => {
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
            { loadBooking: async () => booking(status, locale, mode), send }
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
                  attachments?: Array<{ content: string }>
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
            for (const { content } of input.ctx.attachments ?? []) {
              const ics = content.replace(/\r\n /g, "")
              expect(ics).not.toContain(SERVICE)
              expect(ics).not.toContain(SURNAME)
              for (const fragment of PHONE_FRAGMENTS) {
                expect(ics).not.toContain(fragment)
              }
            }
            for (const fragment of [PHONE, "912345678"]) {
              expect(input.ctx.subject).not.toContain(fragment)
              expect(input.ctx.body).not.toContain(fragment)
              expect(input.ctx.title).not.toContain(fragment)
            }
          }
          if (kind === "booking.confirmed" || kind === "booking.rescheduled") {
            expect(
              (send.mock.calls[0]?.[0] as { ctx: { attachments?: unknown[] } })
                .ctx.attachments
            ).toHaveLength(1)
          }
        })
      }
    }
  }
})
