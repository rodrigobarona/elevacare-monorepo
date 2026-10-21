import { z } from "zod"

export const SESSION_REPORT_PROMPT_VERSION = "session-report.v1" as const

export const SessionReportDraftSchema = z.object({
  summary: z.string().min(1),
  observations: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  followUpQuestions: z.array(z.string()).default([]),
  redFlags: z.array(z.string()).default([]),
  disclaimer: z.string().min(1),
})

export type SessionReportDraft = z.infer<typeof SessionReportDraftSchema>

export const SESSION_REPORT_DRAFT_OUTPUT_KEYS = Object.keys(
  SessionReportDraftSchema.shape
) as (keyof SessionReportDraft)[]

export function buildSessionReportPrompt(input: {
  locale: string
  noteTexts: string[]
  intakeText?: string
}): { system: string; user: string } {
  const languageHint =
    input.locale === "pt"
      ? "European Portuguese"
      : input.locale === "es"
        ? "European Spanish"
        : "English"

  const notesBlock = input.noteTexts
    .map((text, index) => `Note ${index + 1}:\n${text}`)
    .join("\n\n")
  const intakeBlock = input.intakeText?.trim()
    ? `Member intake (typed at booking):\n${input.intakeText.trim()}`
    : ""

  return {
    system: [
      "You are a clinical documentation assistant for licensed experts on Eleva.",
      `Write in ${languageHint}.`,
      "Use only the provided session notes and intake text. Do not invent diagnoses or facts.",
      "Return structured JSON matching the schema fields.",
      "The disclaimer must state the draft requires expert review before sharing with the member.",
    ].join(" "),
    user: [intakeBlock, notesBlock].filter(Boolean).join("\n\n"),
  }
}

export function formatSessionReportDraftBody(
  draft: SessionReportDraft
): string {
  const sections: string[] = [
    draft.summary,
    "",
    "## Observations",
    ...draft.observations.map((line) => `- ${line}`),
    "",
    "## Recommendations",
    ...draft.recommendations.map((line) => `- ${line}`),
  ]
  if (draft.followUpQuestions.length > 0) {
    sections.push(
      "",
      "## Follow-up questions",
      ...draft.followUpQuestions.map((q) => `- ${q}`)
    )
  }
  if (draft.redFlags.length > 0) {
    sections.push(
      "",
      "## Red flags",
      ...draft.redFlags.map((line) => `- ${line}`)
    )
  }
  sections.push("", draft.disclaimer)
  return sections.join("\n").trim()
}
