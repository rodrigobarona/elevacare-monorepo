"use client"

import * as React from "react"
import { SparkleIcon } from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@eleva/ui/components/sheet"
import { cn } from "@eleva/ui/lib/utils"
import { SAMPLE_COPY } from "@/domains/expert-onboarding/lib/assets"
import type { Locale } from "@/domains/expert-onboarding/lib/types"

interface AiSuggestDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (text: string) => void
  context?: string
  locale?: Locale
}

const MOCK_SUGGESTIONS: Record<string, string> = {
  headline:
    "Compassionate women's health specialist supporting members through every stage of their journey.",
  qualifications:
    "Licensed midwife with 8+ years supporting families through pregnancy, birth, and postpartum. Evidence-based care with warm, judgment-free guidance.",
  bio: "I help members feel heard, informed, and confident in their health decisions — with sessions tailored to your goals and pace.",
  eventTitle: "Initial consultation — 50 min",
  eventDescription:
    "A calm first session to understand your goals, review your history, and co-create a care plan you feel confident about.",
  professionalTitle: "Licensed midwife · Women's health",
}

function resolveSuggestion(context: string, locale: Locale): string {
  if (context in SAMPLE_COPY) {
    return SAMPLE_COPY[context as keyof typeof SAMPLE_COPY][locale]
  }
  return MOCK_SUGGESTIONS[context] ?? MOCK_SUGGESTIONS.headline!
}

export function AiSuggestDrawer({
  open,
  onOpenChange,
  onApply,
  context = "headline",
  locale = "en",
}: AiSuggestDrawerProps) {
  const [loading, setLoading] = React.useState(false)
  const suggestion = resolveSuggestion(context, locale)

  const handleApply = () => {
    setLoading(true)
    window.setTimeout(() => {
      onApply(suggestion)
      setLoading(false)
      onOpenChange(false)
    }, 600)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SparkleIcon
              className="size-4 text-eleva-primary"
              weight="duotone"
            />
            Suggest with AI
          </SheetTitle>
          <SheetDescription>
            A draft for this field only. Review and edit before continuing.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 rounded-2xl border border-border/60 bg-muted/30 p-4">
          <p className="text-sm leading-relaxed text-foreground">
            {suggestion}
          </p>
        </div>
        <Button
          className="mt-6 w-full"
          onClick={handleApply}
          disabled={loading}
        >
          {loading ? "Applying…" : "Use this suggestion"}
        </Button>
      </SheetContent>
    </Sheet>
  )
}

export function AiSuggestLink({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-sm font-medium text-eleva-primary underline-offset-4 hover:underline",
        className
      )}
    >
      Suggest with AI
    </button>
  )
}
