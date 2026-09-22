import type { Locale } from "@eleva/config"

import { toPlainText, toSanitizedHtmlFromValue } from "./serialize"
import type {
  LocalizedRichText,
  LocalizedRichTextWrite,
  RichTextSource,
} from "./types"

/**
 * Server helper: turn a client write payload into the stored LocalizedRichText
 * shape with derived `html` / `text` (ADR-023).
 */
export function buildLocalizedRichText(
  write: LocalizedRichTextWrite
): LocalizedRichText {
  const result: LocalizedRichText = {}

  for (const locale of Object.keys(write.locales) as Locale[]) {
    const entry = write.locales[locale]
    if (!entry) continue
    const source: RichTextSource = entry.source ?? "human"
    result[locale] = {
      json: entry.json,
      text: toPlainText(entry.json),
      html: toSanitizedHtmlFromValue(entry.json),
      source,
    }
  }

  return result
}
