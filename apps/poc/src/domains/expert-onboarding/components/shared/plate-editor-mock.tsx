"use client"

import * as React from "react"
import {
  SparkleIcon,
  TextBIcon,
  TextItalicIcon,
  ListBulletsIcon,
} from "@eleva/icons"
import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"
import { AICopilotPanel } from "./ai-copilot-panel"

interface PlateEditorMockProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minLength?: number
  maxLength?: number
  rows?: number
  showAi?: boolean
  onAiApply?: (text: string) => void
  className?: string
}

export function PlateEditorMock({
  label,
  value,
  onChange,
  placeholder,
  minLength,
  maxLength,
  rows = 5,
  showAi = true,
  onAiApply,
  className,
}: PlateEditorMockProps) {
  const [aiOpen, setAiOpen] = React.useState(false)
  const [streaming, setStreaming] = React.useState(false)
  const length = value.length

  const handleAiApply = (text: string) => {
    setStreaming(true)
    onChange("")
    let i = 0
    const interval = setInterval(() => {
      i += 3
      onChange(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setStreaming(false)
        onAiApply?.(text)
      }
    }, 16)
    setAiOpen(false)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {maxLength ? (
          <span
            className={cn(
              "text-xs tabular-nums",
              minLength && length < minLength
                ? "text-amber-600"
                : "text-muted-foreground"
            )}
          >
            {length}
            {maxLength ? ` / ${maxLength}` : ""}
            {minLength ? ` · min ${minLength}` : ""}
          </span>
        ) : null}
      </div>

      <div className="focus-within:poc-warm-glow overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm transition-shadow">
        <div className="flex items-center gap-0.5 border-b border-border/60 bg-muted/30 px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled
          >
            <TextBIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled
          >
            <TextItalicIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled
          >
            <ListBulletsIcon className="size-4" />
          </Button>
          <div className="ml-auto">
            {showAi ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-eleva-primary hover:text-eleva-primary"
                onClick={() => setAiOpen(true)}
              >
                <SparkleIcon className="size-4" weight="duotone" />
                AI assist
              </Button>
            ) : null}
          </div>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={cn(
            "w-full resize-none border-0 bg-transparent px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/70",
            streaming && "text-muted-foreground"
          )}
        />
      </div>

      <AICopilotPanel
        open={aiOpen}
        onOpenChange={setAiOpen}
        onApply={handleAiApply}
        seedText={value}
      />
    </div>
  )
}
