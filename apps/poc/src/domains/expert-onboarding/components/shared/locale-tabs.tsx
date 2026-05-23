"use client"

import { cn } from "@eleva/ui/lib/utils"
import type { Locale } from "@/domains/expert-onboarding/lib/types"

const LABELS: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
}

interface LocaleTabsProps {
  value: Locale
  onChange: (locale: Locale) => void
  className?: string
  compact?: boolean
  filledLocales?: Locale[]
  requiredLocales?: Locale[]
}

export function LocaleTabs({
  value,
  onChange,
  className,
  compact,
  filledLocales,
  requiredLocales,
}: LocaleTabsProps) {
  const locales: Locale[] = ["en", "pt", "es"]
  const filled = new Set(filledLocales ?? [])
  const required = new Set(requiredLocales ?? [])

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-border/80 bg-muted/40 p-1",
        className
      )}
      role="tablist"
      aria-label="Content language"
    >
      {locales.map((locale) => {
        const isFilled = filled.has(locale)
        const isRequired = required.has(locale) && !isFilled

        return (
          <button
            key={locale}
            type="button"
            role="tab"
            aria-selected={value === locale}
            onClick={() => onChange(locale)}
            className={cn(
              "relative rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200",
              compact && "px-2.5 py-1",
              value === locale
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {compact ? locale.toUpperCase() : LABELS[locale]}
            {isFilled ? (
              <span
                className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-eleva-primary"
                aria-hidden
              />
            ) : null}
            {isRequired ? (
              <span className="ml-0.5 text-eleva-primary" aria-label="Required">
                *
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
