export type InternalReportDraft = {
  notes: string
  suggestions: string
  recommendations: string
}

export const EMPTY_INTERNAL_REPORT: InternalReportDraft = {
  notes: "",
  suggestions: "",
  recommendations: "",
}

export function serializeInternalReport(body: InternalReportDraft): string {
  return JSON.stringify({
    notes: body.notes,
    suggestions: body.suggestions,
    recommendations: body.recommendations,
  })
}

export function parseInternalReport(raw: string): InternalReportDraft {
  const trimmed = raw.trim()
  if (!trimmed) return { ...EMPTY_INTERNAL_REPORT }
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      return {
        notes: typeof obj.notes === "string" ? obj.notes : "",
        suggestions: typeof obj.suggestions === "string" ? obj.suggestions : "",
        recommendations:
          typeof obj.recommendations === "string" ? obj.recommendations : "",
      }
    }
  } catch {
    /* plaintext fallback from an older save */
  }
  return { notes: raw, suggestions: "", recommendations: "" }
}
