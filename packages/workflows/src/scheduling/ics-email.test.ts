import { describe, expect, it } from "vitest"
import {
  sendBookingIcsEmail,
  sendCancellationIcsEmail,
  sendRescheduleIcsEmail,
} from "./ics-email"

const payload = {
  expertEmail: "ana@example.com",
  expertName: "Ana",
  memberName: "Ada",
  memberEmail: "ada@example.com",
  eventTypeName: "Visit",
  bookingId: "booking-1",
  startsAt: new Date("2026-09-22T10:00:00.000Z"),
  endsAt: new Date("2026-09-22T10:50:00.000Z"),
  timezone: "Europe/Lisbon",
  sessionMode: "online",
}

describe("ics-email Lane 1 handoff", () => {
  it("does not send Resend mail (sendNotification owns booking kinds)", async () => {
    const previous = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    try {
      await expect(sendBookingIcsEmail(payload)).resolves.toBeUndefined()
      await expect(
        sendRescheduleIcsEmail(payload, payload.startsAt)
      ).resolves.toBeUndefined()
      await expect(sendCancellationIcsEmail(payload)).resolves.toBeUndefined()
    } finally {
      if (previous === undefined) delete process.env.RESEND_API_KEY
      else process.env.RESEND_API_KEY = previous
    }
  })
})
