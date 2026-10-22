import { describe, expect, it } from "vitest"
import { SESSION_REPORT_DRAFT_OUTPUT_KEYS } from "@eleva/ai"
import { redactPayload, shouldRedactKey } from "@eleva/observability"

/**
 * Drift guard: the Sentry/logger key list is hand-maintained in
 * `@eleva/observability`, the AI draft shape lives in `@eleva/ai`. Adding a
 * field to `SessionReportDraftSchema` without redacting it would leak that
 * field to Sentry, so this test fails first.
 */
describe("AI session-report draft redaction", () => {
  it("scrubs every key of the draft schema", () => {
    expect(SESSION_REPORT_DRAFT_OUTPUT_KEYS.length).toBeGreaterThan(0)
    const unredacted = SESSION_REPORT_DRAFT_OUTPUT_KEYS.filter(
      (key) => !shouldRedactKey(key)
    )
    expect(unredacted).toEqual([])
  })

  it("redacts a full draft payload end to end", () => {
    const draft = Object.fromEntries(
      SESSION_REPORT_DRAFT_OUTPUT_KEYS.map((key) => [key, `phi-${key}`])
    )
    const redacted = JSON.stringify(redactPayload({ draft }))
    for (const key of SESSION_REPORT_DRAFT_OUTPUT_KEYS) {
      expect(redacted).not.toContain(`phi-${key}`)
    }
  })
})
