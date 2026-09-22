import { z } from "zod"
import type { Value } from "platejs"

import { LocaleSchema, type Locale } from "@eleva/config"

/**
 * Plate document JSON (ADR-023). Stored under each locale's `json` field.
 * Clients send JSON only — never HTML.
 */
export type PlateValue = Value

export const RICH_TEXT_SOURCES = ["human", "ai_draft"] as const
export type RichTextSource = (typeof RICH_TEXT_SOURCES)[number]

export const EDITOR_AI_CONTEXTS = ["marketing", "clinical"] as const
export type EditorAiContext = (typeof EDITOR_AI_CONTEXTS)[number]

export type LocalizedRichTextEntry = {
  json: PlateValue
  /** Server-derived sanitized HTML. Clients never send this. */
  html: string
  /** Server-derived plain text for FTS and previews. */
  text: string
  source: RichTextSource
}

/**
 * One JSONB column per field (ADR-023). No locale is mandatory; the sibling
 * `<field>_source_locale` column names the language the author wrote in.
 */
export type LocalizedRichText = Partial<Record<Locale, LocalizedRichTextEntry>>

const plateTextSchema = z
  .object({
    text: z.string(),
  })
  .passthrough()

const plateElementSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z
    .object({
      type: z.string().min(1),
      children: z.array(z.union([plateTextSchema, plateElementSchema])),
    })
    .passthrough()
)

const plateValueSchema: z.ZodType<PlateValue> = z.array(
  plateElementSchema
) as unknown as z.ZodType<PlateValue>

export const localizedRichTextEntrySchema = z.object({
  json: plateValueSchema,
  html: z.string(),
  text: z.string(),
  source: z.enum(RICH_TEXT_SOURCES),
})

/** Stored shape. Empty `{}` is valid — clears the field (ADR-023). */
export const localizedRichTextSchema = z.object({
  en: localizedRichTextEntrySchema.optional(),
  pt: localizedRichTextEntrySchema.optional(),
  es: localizedRichTextEntrySchema.optional(),
})

/**
 * Client write payload: Plate JSON + source only. Server derives `html`/`text`.
 */
export const localizedRichTextWriteEntrySchema = z.object({
  json: plateValueSchema,
  source: z.enum(RICH_TEXT_SOURCES).default("human"),
})

export const localizedRichTextWriteSchema = z
  .object({
    sourceLocale: LocaleSchema,
    locales: z.object({
      en: localizedRichTextWriteEntrySchema.optional(),
      pt: localizedRichTextWriteEntrySchema.optional(),
      es: localizedRichTextWriteEntrySchema.optional(),
    }),
  })
  .superRefine((value, ctx) => {
    const sourceEntry = value.locales[value.sourceLocale]
    if (!sourceEntry) {
      ctx.addIssue({
        code: "custom",
        message: "sourceLocale must exist in locales",
        path: ["sourceLocale"],
      })
      return
    }

    const sourceHasText =
      toPlainTextFromNodes(sourceEntry.json).trim().length > 0
    const anyHasText = (["en", "pt", "es"] as const).some((locale) => {
      const entry = value.locales[locale]
      return entry ? toPlainTextFromNodes(entry.json).trim().length > 0 : false
    })

    // All-empty payload clears the field. If any locale has text, the source
    // locale must also have text so sourceLocale stays valid after build.
    if (anyHasText && !sourceHasText) {
      ctx.addIssue({
        code: "custom",
        message:
          "source locale text must be non-empty when any locale has content",
        path: ["locales", value.sourceLocale],
      })
    }
  })

export type LocalizedRichTextWrite = z.infer<
  typeof localizedRichTextWriteSchema
>

/** Walk Plate nodes to plain text without a full editor instance. */
export function toPlainTextFromNodes(value: PlateValue): string {
  const BLOCK_TYPES = new Set([
    "p",
    "h1",
    "h2",
    "h3",
    "blockquote",
    "ul",
    "ol",
    "li",
  ])
  const parts: string[] = []

  const walk = (nodes: readonly unknown[]): void => {
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue
      const record = node as Record<string, unknown>
      if (typeof record.text === "string") {
        parts.push(record.text)
        continue
      }
      if (Array.isArray(record.children)) {
        walk(record.children)
        const type = typeof record.type === "string" ? record.type : "p"
        if (BLOCK_TYPES.has(type)) {
          parts.push("\n")
        }
      }
    }
  }

  walk(value)
  return parts.join("").replace(/\n+$/u, "").trim()
}
