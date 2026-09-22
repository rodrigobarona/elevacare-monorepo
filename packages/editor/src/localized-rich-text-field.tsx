"use client"

import { useState } from "react"

import type { Locale } from "@eleva/config"
import { locales } from "@eleva/config"
import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"

import { RichTextEditor, type RichTextEditorLabels } from "./rich-text-editor"
import type { PlateValue, RichTextSource } from "./types"

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
   * Translate action wires to `POST /ai/editor` in a later 04B PR.
   * Until then the control is visible but inactive when no handler is passed.
   */
  onTranslateFromSource?: (targetLocale: Locale) => void | Promise<void>
}

/**
 * Locale tabs + per-locale Plate editor. "Translate from source" is a stub
 * hook until AI assist lands.
 */
export function LocalizedRichTextField({
  value,
  sourceLocale,
  onChange,
  className,
  isDisabled = false,
  labels: labelsProp,
  editorLabels,
  onTranslateFromSource,
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
  const entry = value[activeLocale]

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
              isDisabled={isDisabled}
              onPress={() => setActiveLocale(locale)}
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
            isDisabled={isDisabled || !onTranslateFromSource}
            onPress={() => {
              void onTranslateFromSource?.(activeLocale)
            }}
          >
            {labels.translateFrom(labels.localeNames[sourceLocale])}
          </Button>
        ) : null}
      </div>
      <RichTextEditor
        key={activeLocale}
        value={entry?.json ?? EMPTY_VALUE}
        isDisabled={isDisabled}
        labels={editorLabels}
        onChange={(json) => {
          onChange({
            sourceLocale,
            locales: {
              ...value,
              [activeLocale]: {
                json,
                source: "human",
              },
            },
          })
        }}
      />
    </div>
  )
}
