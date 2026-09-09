"use client"

import { CheckIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import { resetLocationForCountry } from "@/lib/map-basemaps"
import {
  COUNTRY_LABELS,
  type ExpertDraft,
  type PracticeCountry,
} from "@/domains/expert-onboarding/lib/types"

const COUNTRIES: PracticeCountry[] = ["PT", "ES", "BR"]

interface CountryLocationPickerProps {
  draft: ExpertDraft
  onChange: (
    patch: Partial<ExpertDraft> | ((prev: ExpertDraft) => ExpertDraft)
  ) => void
  onPreviewCountry?: (country: PracticeCountry) => void
}

export function CountryLocationPicker({
  draft,
  onChange,
  onPreviewCountry,
}: CountryLocationPickerProps) {
  const select = (code: PracticeCountry) => {
    onChange(resetLocationForCountry(code))
  }

  return (
    <ul className="space-y-2" role="listbox" aria-label="Practice country">
      {COUNTRIES.map((code) => {
        const selected = draft.practiceCountry === code
        return (
          <li key={code}>
            <button
              type="button"
              role="option"
              aria-selected={selected}
              onMouseEnter={() => onPreviewCountry?.(code)}
              onFocus={() => onPreviewCountry?.(code)}
              onClick={() => select(code)}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all",
                selected
                  ? "border-eleva-primary bg-eleva-primary/5 ring-2 ring-eleva-primary/20"
                  : "border-border/60 bg-background hover:border-eleva-primary/30"
              )}
            >
              <span className="text-lg font-semibold">
                {COUNTRY_LABELS[code]}
              </span>
              {selected ? (
                <span className="flex size-8 items-center justify-center rounded-full bg-eleva-primary text-primary-foreground">
                  <CheckIcon className="size-4" weight="bold" />
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
