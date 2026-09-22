import type { Locale } from "@eleva/config"

import { toPlainText, toSanitizedHtmlFromValue } from "./serialize"
import type {
  LocalizedRichText,
  LocalizedRichTextWrite,
  RichTextSource,
} from "./types"

/**
 * Server helper: turn a client write payload into the stored LocalizedRichText
 * shape with derived `html` / `text` (ADR-023). Locales with empty plain text
 * are omitted so callers can clear a field by writing empty JSON.
 */
export function buildLocalizedRichText(
  write: LocalizedRichTextWrite
): LocalizedRichText {
  const result: LocalizedRichText = {}

  for (const locale of Object.keys(write.locales) as Locale[]) {
    const entry = write.locales[locale]
    if (!entry) continue
    const text = toPlainText(entry.json)
    if (text.trim().length === 0) continue
    const source: RichTextSource = entry.source ?? "human"
    result[locale] = {
      json: entry.json,
      text,
      html: toSanitizedHtmlFromValue(entry.json),
      source,
    }
  }

  return result
}
