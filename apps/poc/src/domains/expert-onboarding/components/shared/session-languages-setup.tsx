"use client"

import { CheckIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import {
  LOCALE_LABELS,
  type ExpertDraft,
  type Locale,
} from "@/domains/expert-onboarding/lib/types"

const LOCALES: Locale[] = ["en", "pt", "es"]

const SESSION_HINTS: Record<Locale, string> = {
  en: "Members can book sessions in English",
  pt: "Membros podem marcar sessões em português",
  es: "Miembros pueden reservar sesiones en español",
}

interface SessionLanguagesSetupProps {
  draft: ExpertDraft
  onChange: (patch: Partial<ExpertDraft>) => void
}

export function SessionLanguagesSetup({
  draft,
  onChange,
}: SessionLanguagesSetupProps) {
  const toggle = (locale: Locale) => {
    const has = draft.languages.includes(locale)
    const next = has
      ? draft.languages.filter((l) => l !== locale)
      : [...draft.languages, locale]
    onChange({
      languages: next.length > 0 ? next : [locale],
    })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {LOCALES.map((locale) => {
        const selected = draft.languages.includes(locale)
        return (
          <button
            key={locale}
            type="button"
            onClick={() => toggle(locale)}
            className={cn(
              "relative rounded-2xl border px-5 py-6 text-left transition-all",
              selected
                ? "border-eleva-primary bg-eleva-primary/5 ring-2 ring-eleva-primary/20"
                : "border-border/60 bg-background hover:border-eleva-primary/30"
            )}
          >
            {selected ? (
              <span className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-full bg-eleva-primary text-primary-foreground">
                <CheckIcon className="size-4" weight="bold" />
              </span>
            ) : null}
            <p className="text-xl font-semibold tracking-tight">
              {LOCALE_LABELS[locale]}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {SESSION_HINTS[locale]}
            </p>
          </button>
        )
      })}
    </div>
  )
}
