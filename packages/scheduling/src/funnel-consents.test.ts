import { describe, expect, it, vi } from "vitest"
import {
  CONSENT_DOCUMENT_VERSION,
  FUNNEL_CONSENT_KINDS,
} from "@eleva/compliance"
import type { Tx } from "@eleva/db"

vi.mock("@eleva/db", () => ({
  findExpertByUsername: vi.fn(),
  getScheduleForBooking: vi.fn(),
  listExpertBusyBookings: vi.fn(),
}))

import { insertFunnelConsents } from "./reserve-booking"

const grants = FUNNEL_CONSENT_KINDS.map((kind) => ({
  kind,
  version: CONSENT_DOCUMENT_VERSION,
}))

function fakeTx() {
  const values = vi.fn(async () => undefined)
  return { values, tx: { insert: () => ({ values }) } as unknown as Tx }
}

const base = {
  orgId: "00000000-0000-4000-8000-000000000001",
  reservationId: "00000000-0000-4000-8000-000000000002",
  locale: "en",
  grants,
  userId: "00000000-0000-4000-8000-000000000003",
}

function kinds(values: ReturnType<typeof fakeTx>["values"]): string[] {
  const [rows] = values.mock.calls[0] as unknown as [Array<{ kind: string }>]
  return rows.map((row) => row.kind)
}

describe("insertFunnelConsents", () => {
  it("records only the required kinds without the AI opt-in", async () => {
    const { tx, values } = fakeTx()
    await insertFunnelConsents(tx, base)
    expect(kinds(values)).toEqual([...FUNNEL_CONSENT_KINDS])
  })

  it("adds a reservation-scoped ai_processing row on opt-in", async () => {
    const { tx, values } = fakeTx()
    await insertFunnelConsents(tx, { ...base, aiProcessing: true })
    const [rows] = values.mock.calls[0] as unknown as [
      Array<{ kind: string; reservationId: string; source: string }>,
    ]
    const ai = rows.find((row) => row.kind === "ai_processing")
    expect(ai).toMatchObject({
      reservationId: base.reservationId,
      source: "funnel",
    })
  })
})
