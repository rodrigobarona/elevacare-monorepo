import { describe, expect, it } from "vitest"
import {
  buildSessionReportPrompt,
  formatSessionReportDraftBody,
  SessionReportDraftSchema,
} from "./session-report.v1"

describe("session-report.v1 prompt", () => {
  it("builds a stable user block from notes and intake", () => {
    const { system, user } = buildSessionReportPrompt({
      locale: "pt",
      noteTexts: ["Member reported knee pain."],
      intakeText: "Goals: return to running",
    })
    expect(system).toContain("European Portuguese")
    expect(user).toContain("Member intake")
    expect(user).toContain("Note 1:")
  })

  it("formats draft body for the report composer", () => {
    const draft = SessionReportDraftSchema.parse({
      summary: "Progress noted.",
      observations: ["Improved range of motion"],
      recommendations: ["Continue exercises"],
      followUpQuestions: [],
      redFlags: [],
      disclaimer: "Draft — expert review required.",
    })
    const body = formatSessionReportDraftBody(draft)
    expect(body).toContain("## Observations")
    expect(body).toContain("Draft — expert review required.")
  })
})
