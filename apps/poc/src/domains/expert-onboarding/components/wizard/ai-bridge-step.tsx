"use client"

import * as React from "react"
import { cn } from "@eleva/ui/lib/utils"
import { SAMPLE_COPY } from "@/domains/expert-onboarding/lib/assets"
import type { ExpertDraft } from "@/domains/expert-onboarding/lib/types"

interface AiBridgeStepProps {
  title: string
  helper?: string
  onChange: (patch: Partial<ExpertDraft>) => void
}

export function AiBridgeStep({ title, helper, onChange }: AiBridgeStepProps) {
  const [generating, setGenerating] = React.useState(true)

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      onChange({
        headline: SAMPLE_COPY.headline,
        qualifications: SAMPLE_COPY.qualifications,
        bio: {
          en: "Warm, evidence-based support tailored to each member.",
          pt: "Acompanhamento acolhedor e baseado em evidência.",
          es: "Apoyo cálido y basado en evidencia.",
        },
      })
      setGenerating(false)
    }, 1800)
    return () => window.clearTimeout(timer)
  }, [onChange])

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div
        className={cn(
          "size-12 rounded-full bg-eleva-primary/20",
          generating && "animate-pulse"
        )}
      />
      <h1 className="mt-8 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{helper}</p>
      {!generating ? (
        <p className="mt-6 text-sm font-medium text-emerald-600">
          Draft ready — continue
        </p>
      ) : null}
    </div>
  )
}
