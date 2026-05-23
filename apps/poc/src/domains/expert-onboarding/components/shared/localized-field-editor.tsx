"use client"

import * as React from "react"
import { SparkleIcon, TranslateIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"
import { LocaleTabs } from "@/domains/expert-onboarding/components/shared/locale-tabs"
import type { ExpertDraft, Locale } from "@/domains/expert-onboarding/lib/types"
import type { LocalizedField } from "@/domains/expert-onboarding/lib/draft-fields"
import {
  getLocalized,
  setLocalized,
} from "@/domains/expert-onboarding/lib/draft-fields"
import { applyLocalizedTranslation } from "@/domains/expert-onboarding/lib/mock-translate"

const ALL_LOCALES: Locale[] = ["en", "pt", "es"]

export interface LocalizedFieldEditorProps {
  draft: ExpertDraft
  field: LocalizedField
  onChange: (
    patch: Partial<ExpertDraft> | ((prev: ExpertDraft) => ExpertDraft)
  ) => void
  multiline?: boolean
  minLength?: number
  maxLength?: number
  placeholder?: string
  onSuggest?: () => void
}

export function LocalizedFieldEditor({
  draft,
  field,
  onChange,
  multiline = false,
  minLength = 8,
  maxLength,
  placeholder,
  onSuggest,
}: LocalizedFieldEditorProps) {
  const [translating, setTranslating] = React.useState(false)
  const [activeLocale, setActiveLocale] = React.useState<Locale>(
    draft.primaryLocale
  )

  React.useEffect(() => {
    setActiveLocale(draft.primaryLocale)
  }, [draft.primaryLocale])

  const activeValue = getLocalized(draft, field, activeLocale)

  const filledLocales = ALL_LOCALES.filter((locale) =>
    getLocalized(draft, field, locale).trim()
  )
  const requiredLocales = draft.languages.filter(
    (locale) => !getLocalized(draft, field, locale).trim()
  )

  const handleTabChange = (locale: Locale) => {
    setActiveLocale(locale)
    onChange({ primaryLocale: locale })
  }

  const setValue = (locale: Locale, value: string) => {
    onChange((prev) => {
      const next = setLocalized(prev, field, locale, value)
      return locale === activeLocale ? { ...next, primaryLocale: locale } : next
    })
  }

  const handleTranslate = () => {
    if (!activeValue.trim()) return
    setTranslating(true)
    window.setTimeout(() => {
      onChange((prev) =>
        applyLocalizedTranslation(
          prev,
          field,
          activeLocale,
          activeValue,
          ALL_LOCALES.filter((l) => l !== activeLocale)
        )
      )
      setTranslating(false)
    }, 900)
  }

  const InputComponent = multiline ? "textarea" : "input"

  return (
    <div className="w-full space-y-4">
      <LocaleTabs
        value={activeLocale}
        onChange={handleTabChange}
        filledLocales={filledLocales}
        requiredLocales={requiredLocales}
      />

      <InputComponent
        {...(multiline ? { rows: 6 } : {})}
        value={activeValue}
        onChange={(e) => setValue(activeLocale, e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-xl border border-input bg-background px-4 py-4 text-lg leading-relaxed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          !multiline && "h-14"
        )}
      />

      {minLength > 0 ? (
        <p className="text-sm text-muted-foreground tabular-nums">
          {activeValue.length}
          {maxLength ? ` / ${maxLength}` : ""}
          {minLength ? ` · ${minLength} character minimum` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="default"
          className="gap-2"
          disabled={translating || activeValue.trim().length < 3}
          onClick={handleTranslate}
        >
          <TranslateIcon className="size-4" weight="duotone" />
          {translating ? "Translating…" : "Translate other languages with AI"}
        </Button>
        {onSuggest ? (
          <Button
            type="button"
            variant="ghost"
            size="default"
            className="gap-2"
            onClick={onSuggest}
          >
            <SparkleIcon
              className="size-4 text-eleva-primary"
              weight="duotone"
            />
            Suggest with AI
          </Button>
        ) : null}
      </div>
    </div>
  )
}
