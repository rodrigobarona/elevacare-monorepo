"use client"

import { useId } from "react"
import { ToggleButton, ToggleButtonGroup } from "react-aria-components"
import { cn } from "@eleva/ui/lib/utils"

export type LanguageChip = {
  id: string
  label: string
}

export function LanguageChips({
  languages,
  selectedKey,
  onSelectionChange,
  label,
  className,
}: {
  languages: readonly LanguageChip[]
  selectedKey: string
  onSelectionChange: (id: string) => void
  label: string
  className?: string
}) {
  const labelId = useId()
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>
      <ToggleButtonGroup
        data-slot="language-chips"
        aria-labelledby={labelId}
        orientation="horizontal"
        selectionMode="single"
        selectedKeys={new Set([selectedKey])}
        onSelectionChange={(keys) => {
          const next = [...keys][0]
          if (typeof next === "string") onSelectionChange(next)
        }}
        className="flex flex-wrap gap-2"
      >
        {languages.map((language) => (
          <ToggleButton
            key={language.id}
            id={language.id}
            className={cn(
              "rounded-full border border-transparent bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
              "hover:bg-muted/80",
              "data-selected:bg-primary data-selected:text-primary-foreground",
              "data-focus-visible:ring-3 data-focus-visible:ring-ring/30"
            )}
          >
            {language.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  )
}
