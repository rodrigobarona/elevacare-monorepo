import { inspect } from "node:util"
import { describe, expect, it } from "vitest"
import {
  Decrypted,
  isDecrypted,
  registerPhi,
  registeredPhiCount,
  scrubRegisteredPhi,
  withPhiScope,
} from "./phi"
import { redactPayload } from "./redaction"
import { sanitizeSentryEvent } from "./sentry-event"

const RECORD = {
  title: "Session notes",
  body: "Member reports lower back pain after the 10k run on Sunday",
  transcript: "I felt a sharp pull near the left hip flexor",
}
const PHI_STRINGS = [RECORD.body, RECORD.transcript, "lower back pain"]

function expectNoPhi(output: unknown) {
  const text = JSON.stringify(output)
  for (const phi of PHI_STRINGS) expect(text).not.toContain(phi)
}

describe("Decrypted", () => {
  it("never serializes its value", () => {
    const value = new Decrypted(RECORD)
    expect(JSON.stringify({ record: value })).toBe('{"record":"[redacted]"}')
    expect(String(value)).toBe("[redacted]")
    expect(`${value}`).toBe("[redacted]")
    expect(inspect({ record: value })).not.toContain("back pain")
    expect(isDecrypted(value)).toBe(true)
    expect(value.reveal()).toEqual(RECORD)
  })

  it("is redacted by the payload walk", () => {
    expect(redactPayload({ extra: new Decrypted(RECORD) })).toEqual({
      extra: "[redacted]",
    })
  })
})

describe("PHI registry", () => {
  it("is a no-op outside a scope", () => {
    registerPhi(RECORD.body)
    expect(registeredPhiCount()).toBe(0)
    expect(scrubRegisteredPhi(RECORD.body)).toBe(RECORD.body)
  })

  it("scrubs exact and embedded plaintext inside a scope", () => {
    withPhiScope(() => {
      registerPhi(RECORD.body)
      expect(scrubRegisteredPhi(RECORD.body)).toBe("[phi]")
      expect(scrubRegisteredPhi(`failed: ${RECORD.body} (retry)`)).toBe(
        "failed: [phi] (retry)"
      )
    })
  })

  it("isolates concurrent scopes", async () => {
    await Promise.all([
      withPhiScope(async () => {
        registerPhi(RECORD.body)
        await new Promise((resolve) => setTimeout(resolve, 5))
        expect(registeredPhiCount()).toBe(1)
      }),
      withPhiScope(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1))
        expect(scrubRegisteredPhi(RECORD.body)).toBe(RECORD.body)
      }),
    ])
  })

  it("ignores values too short to match safely", () => {
    withPhiScope(() => {
      registerPhi("pain")
      expect(registeredPhiCount()).toBe(0)
    })
  })
})

describe("Sentry event sanitizer", () => {
  it("keeps a decrypted record out of every event location", () => {
    withPhiScope(() => {
      for (const value of Object.values(RECORD)) registerPhi(value)
      const error = new Error(`upsert failed for ${RECORD.body}`)
      const event = {
        event_id: "abc",
        message: `could not save ${RECORD.transcript}`,
        exception: {
          values: [
            {
              type: "Error",
              value: error.message,
              stacktrace: {
                frames: [{ function: "persistKind", vars: { record: RECORD } }],
              },
            },
          ],
        },
        breadcrumbs: [
          { message: `typed ${RECORD.body}`, data: { draft: RECORD.body } },
        ],
        request: {
          url: "https://api.eleva.care/sessions/x/records",
          data: JSON.stringify({ kind: "notes", body: RECORD.body }),
          query_string: `q=${RECORD.transcript}`,
        },
        tags: { last_note: RECORD.body.slice(0, 40) + RECORD.body.slice(40) },
        extra: { record: new Decrypted(RECORD), error },
        spans: [{ data: { "db.statement": `select '${RECORD.body}'` } }],
        newSdkField: { payload: RECORD },
      }
      const out = sanitizeSentryEvent(event) as Record<string, unknown>
      expectNoPhi(out)
      expect(out.newSdkField).toBeUndefined()
      expect(out.event_id).toBe("abc")
    })
  })
})
