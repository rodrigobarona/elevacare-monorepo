import { describe, expect, it, vi } from "vitest"

import {
  BOOKING_PROBE_FAKE_RESERVATION_ID,
  BOOKING_PROBE_FAKE_TOKEN,
  recoverIntentCheck,
  runBookingFunnelProbes,
} from "./booking-probes"

const MODE_ID = "11111111-1111-4111-8111-111111111111"
const SCHEDULE_ID = "22222222-2222-4222-8222-222222222222"

const offerBody = {
  username: "fisiomota",
  slug: "first-visit",
  title: { en: "First visit" },
  description: null,
  durationMinutes: 60,
  priceAmount: 6000,
  currency: "EUR",
  languages: ["pt", "en"],
  sessionMode: "online",
  modes: [
    {
      id: MODE_ID,
      mode: "online",
      priceCents: 6000,
      currency: "EUR",
      durationMinutes: 60,
      countryScopeType: "list",
      countryScopeCodes: ["PT"],
      languages: ["pt"],
      label: null,
      location: null,
    },
  ],
}

const slotsBody = {
  slots: [],
  priceCents: 6000,
  durationMinutes: 60,
  scheduleId: SCHEDULE_ID,
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

describe("runBookingFunnelProbes", () => {
  it("passes when the offer, slots, and intent routes are healthy", async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/slots")) return jsonResponse(200, slotsBody)
      if (url.includes("/event-types/first-visit")) {
        return jsonResponse(200, offerBody)
      }
      expect(init?.method).toBe("POST")
      expect(JSON.parse(String(init?.body))).toEqual({
        reservationId: BOOKING_PROBE_FAKE_RESERVATION_ID,
        reservationToken: BOOKING_PROBE_FAKE_TOKEN,
      })
      return jsonResponse(404, { error: "not_found" })
    })

    const report = await runBookingFunnelProbes({
      baseUrl: "https://api.dev.eleva.care",
      fetchImpl,
      now: new Date("2026-09-10T09:00:00.000Z"),
    })

    expect(report.ok).toBe(true)
    expect(report.checks.map((check) => check.name)).toEqual([
      "slots",
      "intent",
    ])
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it("fails when slots return a non-200", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/slots")) return jsonResponse(500, { error: "down" })
      if (url.includes("/event-types/first-visit")) {
        return jsonResponse(200, offerBody)
      }
      return jsonResponse(404, { error: "not_found" })
    })

    const report = await runBookingFunnelProbes({
      baseUrl: "https://api.dev.eleva.care",
      fetchImpl,
    })

    expect(report.ok).toBe(false)
    expect(report.checks.find((check) => check.name === "slots")?.ok).toBe(
      false
    )
  })

  it("marks intent 403 as BotID-blocked so the cron can recover", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/slots")) return jsonResponse(200, slotsBody)
      if (url.includes("/event-types/first-visit")) {
        return jsonResponse(200, offerBody)
      }
      return jsonResponse(403, { error: "blocked" })
    })

    const report = await runBookingFunnelProbes({
      baseUrl: "https://api.dev.eleva.care",
      fetchImpl,
    })

    const intent = report.checks.find((check) => check.name === "intent")
    expect(report.ok).toBe(false)
    expect(intent?.blockedByBotId).toBe(true)
    expect(recoverIntentCheck(intent!, "not_found").ok).toBe(true)
    expect(recoverIntentCheck(intent!, "db_error").ok).toBe(false)
  })

  it("treats intent 422 as healthy (route + Zod, no PaymentIntent)", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/slots")) return jsonResponse(200, slotsBody)
      if (url.includes("/event-types/first-visit")) {
        return jsonResponse(200, offerBody)
      }
      return jsonResponse(422, { error: "validation" })
    })

    const report = await runBookingFunnelProbes({
      baseUrl: "https://api.dev.eleva.care",
      fetchImpl,
    })

    expect(report.ok).toBe(true)
  })

  it("fails when intent 404 is a generic miss, not not_found", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/slots")) return jsonResponse(200, slotsBody)
      if (url.includes("/event-types/first-visit")) {
        return jsonResponse(200, offerBody)
      }
      return jsonResponse(404, { error: "NOT_FOUND" })
    })

    const report = await runBookingFunnelProbes({
      baseUrl: "https://api.dev.eleva.care",
      fetchImpl,
    })

    expect(report.ok).toBe(false)
    expect(report.checks.find((check) => check.name === "intent")?.ok).toBe(
      false
    )
  })
})
