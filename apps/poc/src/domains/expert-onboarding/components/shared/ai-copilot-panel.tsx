"use client"

import * as React from "react"
import {
  SparkleIcon,
  TranslateIcon,
  ArrowsClockwiseIcon,
  TextAlignLeftIcon,
} from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eleva/ui/components/dialog"
import { SAMPLE_COPY } from "@/domains/expert-onboarding/lib/assets"

interface AICopilotPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (text: string) => void
  seedText?: string
}

const ACTIONS = [
  {
    id: "improve",
    label: "Improve writing",
    icon: SparkleIcon,
    result: SAMPLE_COPY.qualifications.en,
  },
  {
    id: "shorten",
    label: "Make concise",
    icon: TextAlignLeftIcon,
    result:
      "Licensed midwife supporting families through pregnancy and postpartum with evidence-based, warm care.",
  },
  {
    id: "translate",
    label: "Match all languages",
    icon: TranslateIcon,
    result: SAMPLE_COPY.qualifications.en,
  },
  {
    id: "tone",
    label: "Warmer tone",
    icon: ArrowsClockwiseIcon,
    result:
      "I'm a licensed midwife who loves walking alongside families — with clinical rigor, empathy, and zero judgment.",
  },
] as const

export function AICopilotPanel({
  open,
  onOpenChange,
  onApply,
}: AICopilotPanelProps) {
  const [loading, setLoading] = React.useState<string | null>(null)

  const run = (id: string, result: string) => {
    setLoading(id)
    window.setTimeout(() => {
      onApply(result)
      setLoading(null)
      onOpenChange(false)
    }, 900)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparkleIcon
              className="size-5 text-eleva-primary"
              weight="duotone"
            />
            Eleva AI writing assist
          </DialogTitle>
          <DialogDescription>
            Powered by GPT via Vercel AI Gateway — keeps your voice consistent
            across EN, PT, and ES.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {ACTIONS.map(({ id, label, icon: Icon, result }) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 rounded-xl px-4 py-3 text-left"
              disabled={loading !== null}
              onClick={() => run(id, result)}
            >
              <Icon
                className="size-5 shrink-0 text-eleva-primary"
                weight="duotone"
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">{label}</span>
                {loading === id ? (
                  <span className="text-xs text-muted-foreground">
                    Drafting…
                  </span>
                ) : null}
              </span>
            </Button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Mock demo — production uses streaming Plate AI + rate-limited API
          route.
        </p>
      </DialogContent>
    </Dialog>
  )
}
