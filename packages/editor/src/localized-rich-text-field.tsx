"use client"

import { useState, useTransition } from "react"

import type { Locale } from "@eleva/config"
import { locales } from "@eleva/config"
import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"

import { RichTextEditor, type RichTextEditorLabels } from "./rich-text-editor"
import type { RichTextEditorProps } from "./rich-text-editor"
import type { PlateValue, RichTextSource } from "./types"
import { plainTextToPlateValue, toPlainTextFromNodes } from "./types"

const EMPTY_VALUE: PlateValue = [{ type: "p", children: [{ text: "" }] }]

export type LocalizedRichTextFieldValue = Partial<
  Record<
    Locale,
    {
      json: PlateValue
      source: RichTextSource
    }
  >
>

export type LocalizedRichTextFieldLabels = {
  localeNames: Record<Locale, string>
  sourceBadge: string
  aiDraftBadge: string
  translateFrom: (sourceLocaleName: string) => string
  translating: string
  translateFailed: string
  sourceEmpty: string
}

const DEFAULT_FIELD_LABELS: LocalizedRichTextFieldLabels = {
  localeNames: {
    en: "English",
    pt: "Português",
    es: "Español",
  },
  sourceBadge: "source",
  aiDraftBadge: "AI draft",
  translateFrom: (sourceLocaleName) => `Translate from ${sourceLocaleName}`,
  translating: "Translating…",
  translateFailed: "Translation failed",
  sourceEmpty: "Write the source text first",
}

export type LocalizedRichTextFieldProps = {
  value: LocalizedRichTextFieldValue
  sourceLocale: Locale
  onChange: (next: {
    sourceLocale: Locale
    locales: LocalizedRichTextFieldValue
  }) => void
  className?: string
  isDisabled?: boolean
  labels?: Partial<LocalizedRichTextFieldLabels>
  editorLabels?: Partial<RichTextEditorLabels>
  /**
   * Optional AI assist for the active locale editor (improve / shorten /
   * fix_grammar). Wire to `POST /ai/editor` via `@eleva/api-client`.
   */
  ai?: RichTextEditorProps["ai"]
  /**
   * Returns the translated plain text (`POST /ai/editor` command `translate`).
   * The field stores it as `ai_draft` until the author edits that tab.
   */
  onTranslate?: (input: {
    text: string
    sourceLocale: Locale
    targetLocale: Locale
  }) => Promise<string>
}

/**
 * Locale tabs + per-locale Plate editor. Pass `ai` / `onTranslate`
 * to wire `POST /ai/editor`.
 */
export function LocalizedRichTextField({
  value,
  sourceLocale,
  onChange,
  className,
  isDisabled = false,
  labels: labelsProp,
  editorLabels,
  ai,
  onTranslate,
}: LocalizedRichTextFieldProps) {
  const labels: LocalizedRichTextFieldLabels = {
    ...DEFAULT_FIELD_LABELS,
    ...labelsProp,
    localeNames: {
      ...DEFAULT_FIELD_LABELS.localeNames,
      ...labelsProp?.localeNames,
    },
  }
  const [activeLocale, setActiveLocale] = useState<Locale>(sourceLocale)
  // Plate is uncontrolled: bump to remount the editor with translated text.
  const [revision, setRevision] = useState(0)
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [isTranslating, startTranslating] = useTransition()
  const entry = value[activeLocale]
  const sourceText = toPlainTextFromNodes(
    value[sourceLocale]?.json ?? EMPTY_VALUE
  )

  function translateInto(targetLocale: Locale) {
    if (!onTranslate) return
    if (!sourceText) {
      setTranslateError(labels.sourceEmpty)
      return
    }
    setTranslateError(null)
    startTranslating(async () => {
      try {
        const translated = (
          await onTranslate({ text: sourceText, sourceLocale, targetLocale })
        ).trim()
        if (!translated) {
          setTranslateError(labels.translateFailed)
          return
        }
        onChange({
          sourceLocale,
          locales: {
            ...value,
            [targetLocale]: {
              json: plainTextToPlateValue(translated),
              source: "ai_draft",
            },
          },
        })
        setRevision((current) => current + 1)
      } catch {
        setTranslateError(labels.translateFailed)
      }
    })
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {locales.map((locale) => {
          const isActive = locale === activeLocale
          const isSource = locale === sourceLocale
          const isAiDraft = value[locale]?.source === "ai_draft"
          return (
            <Button
              key={locale}
              type="button"
              size="sm"
              variant={isActive ? "secondary" : "ghost"}
              isDisabled={isDisabled || isTranslating}
              onPress={() => {
                setActiveLocale(locale)
                setTranslateError(null)
              }}
            >
              {labels.localeNames[locale]}
              {isSource ? ` · ${labels.sourceBadge}` : ""}
              {isAiDraft ? ` · ${labels.aiDraftBadge}` : ""}
            </Button>
          )
        })}
        {activeLocale !== sourceLocale ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ms-auto"
            isDisabled={isDisabled || isTranslating || !onTranslate}
            onPress={() => translateInto(activeLocale)}
          >
            {isTranslating
              ? labels.translating
              : labels.translateFrom(labels.localeNames[sourceLocale])}
          </Button>
        ) : null}
      </div>
      {translateError ? (
        <p role="alert" className="text-sm text-destructive">
          {translateError}
        </p>
      ) : null}
      <RichTextEditor
        key={`${activeLocale}:${revision}`}
        value={entry?.json ?? EMPTY_VALUE}
        locale={activeLocale}
        isDisabled={isDisabled || isTranslating}
        labels={editorLabels}
        ai={ai}
        onChangeWithSource={(json, source) => {
          onChange({
            sourceLocale,
            locales: {
              ...value,
              [activeLocale]: {
                json,
                source,
              },
            },
          })
        }}
      />
    </div>
  )
}
