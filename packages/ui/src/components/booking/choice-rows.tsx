"use client"

import { Radio, RadioGroup } from "react-aria-components"
import { cn } from "@eleva/ui/lib/utils"

export type ChoiceRowItem = {
  id: string
  title: string
  /** Quiet second line, e.g. "60 min · €60 total". */
  meta?: string
}

/**
 * Compact single-choice rows (a radio group that reads as a short list),
 * e.g. the service picker on an expert's booking card. Rows are at least
 * 44 px tall and keep one tab stop with arrow-key navigation.
 */
export function ChoiceRows({
  items,
  selectedKey,
  onSelectionChange,
  labelledBy,
  className,
}: {
  items: readonly ChoiceRowItem[]
  selectedKey: string
  onSelectionChange: (id: string) => void
  /** Id of the visible label for the group. */
  labelledBy: string
  className?: string
}) {
  return (
    <RadioGroup
      data-slot="choice-rows"
      aria-labelledby={labelledBy}
      value={selectedKey}
      onChange={onSelectionChange}
      className={cn("flex flex-col gap-2", className)}
    >
      {items.map((item) => (
        <Radio
          key={item.id}
          value={item.id}
          className={({ isSelected, isFocusVisible }) =>
            cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-input-border px-4 py-2.5 text-sm transition-colors",
              isSelected
                ? "border-primary bg-teal-50 dark:bg-teal-950"
                : "hover:bg-muted",
              isFocusVisible && "ring-3 ring-ring/50"
            )
          }
        >
          {({ isSelected }) => (
            <>
              <span
                aria-hidden
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full border",
                  isSelected
                    ? "border-primary bg-primary"
                    : "border-input-border"
                )}
              >
                {isSelected ? (
                  <span className="size-1.5 rounded-full bg-primary-foreground" />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-foreground">
                  {item.title}
                </span>
                {item.meta ? (
                  <span className="text-muted-foreground">{item.meta}</span>
                ) : null}
              </span>
            </>
          )}
        </Radio>
      ))}
    </RadioGroup>
  )
}
