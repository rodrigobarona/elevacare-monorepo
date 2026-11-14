import { describe, expect, it } from "vitest"
import {
  buildSessionReportPrompt,
  formatSessionReportDraftBody,
  SESSION_REPORT_DRAFT_OUTPUT_KEYS,
  SessionReportDraftSchema,
} from "./session-report.v2"

describe("session-report.v2 prompt", () => {
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

  it("tells the model to add no clinical content of its own", () => {
    const { system } = buildSessionReportPrompt({
      locale: "en",
      noteTexts: ["Note"],
    })
    expect(system).toContain("Add no clinical content of your own")
    expect(system).toContain("Never fill a list with your own suggestions")
  })

  /**
   * Intended-purpose guard: the draft restates the expert's notes. A field
   * that asks the model for its own advice or risk flags would change what
   * the feature is, so adding one must fail here first.
   */
  it("has no field for model-originated advice or risk flags", () => {
    expect([...SESSION_REPORT_DRAFT_OUTPUT_KEYS].sort()).toEqual([
      "disclaimer",
      "followUpsNoted",
      "observations",
      "planNoted",
      "summary",
    ])
  })

  it("formats the draft body with localised headings and skips empty lists", () => {
    const draft = SessionReportDraftSchema.parse({
      summary: "Progresso registado.",
      observations: ["Melhor amplitude de movimento"],
      planNoted: ["Continuar os exercícios"],
      followUpsNoted: [],
      disclaimer: "Rascunho — requer revisão do especialista.",
    })
    const body = formatSessionReportDraftBody(draft, "pt")
    expect(body).toContain("## O que anotou")
    expect(body).toContain("## Plano que anotou")
    expect(body).not.toContain("Seguimento que anotou")
    expect(body).toContain("Rascunho — requer revisão do especialista.")
  })

  it("falls back to English headings for an unknown locale", () => {
    const draft = SessionReportDraftSchema.parse({
      summary: "Progress noted.",
      observations: ["Improved range of motion"],
      disclaimer: "Draft — expert review required.",
    })
    expect(formatSessionReportDraftBody(draft, "fr")).toContain(
      "## What you noted"
    )
  })
})
