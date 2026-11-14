import { z } from "zod"

import { describeLocale } from "../locale-variants"

export const SESSION_REPORT_PROMPT_VERSION = "session-report.v2" as const

/**
 * Extractive by contract: every field restates what the expert wrote. The
 * model adds no clinical content of its own, so there is no field for
 * model-originated advice, warnings or risk flags (intended purpose:
 * `docs/eleva-v3/ai-reporting-spec.md`, "Intended purpose per feature").
 */
export const SessionReportDraftSchema = z.object({
  summary: z.string().min(1),
  observations: z.array(z.string()).default([]),
  planNoted: z.array(z.string()).default([]),
  followUpsNoted: z.array(z.string()).default([]),
  disclaimer: z.string().min(1),
})

export type SessionReportDraft = z.infer<typeof SessionReportDraftSchema>

export const SESSION_REPORT_DRAFT_OUTPUT_KEYS = Object.keys(
  SessionReportDraftSchema.shape
) as (keyof SessionReportDraft)[]

type DraftHeadings = {
  observations: string
  planNoted: string
  followUpsNoted: string
}

const DRAFT_HEADINGS: Record<"en" | "pt" | "es", DraftHeadings> = {
  en: {
    observations: "What you noted",
    planNoted: "Plan you noted",
    followUpsNoted: "Follow-ups you noted",
  },
  pt: {
    observations: "O que anotou",
    planNoted: "Plano que anotou",
    followUpsNoted: "Seguimento que anotou",
  },
  es: {
    observations: "Lo que anotaste",
    planNoted: "Plan que anotaste",
    followUpsNoted: "Seguimiento que anotaste",
  },
}

function headingsFor(locale: string): DraftHeadings {
  const code = locale.trim().toLowerCase()
  return code === "pt" || code === "es"
    ? DRAFT_HEADINGS[code]
    : DRAFT_HEADINGS.en
}

export function buildSessionReportPrompt(input: {
  locale: string
  noteTexts: string[]
  intakeText?: string
}): { system: string; user: string } {
  const notesBlock = input.noteTexts
    .map((text, index) => `Note ${index + 1}:\n${text}`)
    .join("\n\n")
  const intakeBlock = input.intakeText?.trim()
    ? `Member intake (typed at booking):\n${input.intakeText.trim()}`
    : ""

  return {
    system: [
      "You are a documentation assistant for licensed experts on Eleva.",
      "You reorganise the expert's own session notes into a draft the expert will edit.",
      `Write in ${describeLocale(input.locale)}.`,
      "Use only what the provided session notes and intake text say.",
      "Add no clinical content of your own: no diagnosis, assessment, advice, recommendation, warning or risk flag, and nothing inferred beyond the text.",
      "`observations` restates what the expert recorded.",
      "`planNoted` lists only the plan, advice or next steps the expert wrote in the notes.",
      "`followUpsNoted` lists only the follow-ups the expert wrote in the notes.",
      "When the notes contain none, return an empty list. Never fill a list with your own suggestions.",
      "Return structured JSON matching the schema fields.",
      "The disclaimer must state that AI organised this draft from the expert's notes and that the expert must review it before sharing it with the member.",
    ].join(" "),
    user: [intakeBlock, notesBlock].filter(Boolean).join("\n\n"),
  }
}

function section(heading: string, lines: string[]): string[] {
  return lines.length > 0
    ? ["", `## ${heading}`, ...lines.map((line) => `- ${line}`)]
    : []
}

export function formatSessionReportDraftBody(
  draft: SessionReportDraft,
  locale = "en"
): string {
  const headings = headingsFor(locale)
  return [
    draft.summary,
    ...section(headings.observations, draft.observations),
    ...section(headings.planNoted, draft.planNoted),
    ...section(headings.followUpsNoted, draft.followUpsNoted),
    "",
    draft.disclaimer,
  ]
    .join("\n")
    .trim()
}
