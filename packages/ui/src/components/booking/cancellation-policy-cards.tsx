"use client"

import { Radio, RadioGroup } from "react-aria-components"
import { cn } from "@eleva/ui/lib/utils"

export type CancellationPolicyCardItem = {
  id: string
  name: string
  lines: readonly string[]
}

export function CancellationPolicyCards({
  policies,
  selectedKey,
  onSelectionChange,
  label,
  isDisabled,
  className,
}: {
  policies: readonly CancellationPolicyCardItem[]
  selectedKey: string
  onSelectionChange: (id: string) => void
  label: string
  isDisabled?: boolean
  className?: string
}) {
  return (
    <RadioGroup
      data-slot="cancellation-policy-cards"
      data-testid="cancellation-policy-cards"
      aria-label={label}
      value={selectedKey}
      onChange={onSelectionChange}
      isDisabled={isDisabled}
      className={cn("grid gap-3 md:grid-cols-3", className)}
    >
      {policies.map((policy) => (
        <Radio
          key={policy.id}
          value={policy.id}
          data-testid="cancellation-policy-option"
          className={cn(
            "relative flex cursor-pointer flex-col gap-2 rounded-3xl bg-card p-4 text-left shadow-sm ring-1 ring-foreground/10 transition-shadow",
            "data-focus-visible:ring-3 data-focus-visible:ring-ring/30",
            "data-selected:ring-2 data-selected:ring-primary",
            "data-disabled:cursor-not-allowed data-disabled:opacity-60"
          )}
        >
          <p className="font-heading text-base font-medium">{policy.name}</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {policy.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Radio>
      ))}
    </RadioGroup>
  )
}
