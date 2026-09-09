"use client"

import type { ReactNode } from "react"
import { Radio, RadioGroup } from "react-aria-components"
import {
  MapPinIcon,
  MonitorIcon,
  PhoneIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import { PriceTag } from "@eleva/ui/components/booking/price-tag"
import type { ModeBookableError } from "@eleva/ui/lib/booking/mode-bookable"
import { cn } from "@eleva/ui/lib/utils"

export type BookingModeKind = "online" | "phone" | "in_person"

export type ModeCardItem = {
  id: string
  kind: BookingModeKind
  title: string
  description?: string
  locationName?: string
  city?: string
  priceCents: number
  durationMinutes: number
  disabled?: boolean
  disabledReason?: ModeBookableError
}

export function ModeCards({
  modes,
  selectedKey,
  onSelectionChange,
  locale,
  label,
  reasonCopy,
  alternativeHint,
  durationLabel,
  className,
}: {
  modes: readonly ModeCardItem[]
  selectedKey: string | null
  onSelectionChange: (id: string) => void
  locale: string
  label: string
  reasonCopy: Record<ModeBookableError, string>
  alternativeHint?: string
  durationLabel: (minutes: number) => string
  className?: string
}) {
  return (
    <RadioGroup
      data-slot="mode-cards"
      data-testid="booking-mode-cards"
      aria-label={label}
      value={selectedKey}
      onChange={onSelectionChange}
      className={cn("grid gap-3 sm:grid-cols-2", className)}
    >
      {modes.map((mode) => (
        <Radio
          key={mode.id}
          value={mode.id}
          data-testid="booking-mode-option"
          isDisabled={mode.disabled}
          className={cn(
            "group/mode relative flex cursor-pointer flex-col gap-4 rounded-4xl bg-card p-5 text-left shadow-md ring-1 ring-foreground/5 transition-shadow",
            "data-focus-visible:ring-3 data-focus-visible:ring-ring/30",
            "data-selected:ring-2 data-selected:ring-primary",
            "data-disabled:cursor-not-allowed data-disabled:opacity-60"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ModeIcon kind={mode.kind} />
            </span>
            <PriceTag cents={mode.priceCents} locale={locale} />
          </div>
          <div className="space-y-1">
            <p className="font-heading text-base font-medium">{mode.title}</p>
            {mode.locationName || mode.city ? (
              <p className="text-sm text-muted-foreground">
                {[mode.locationName, mode.city].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            {mode.description ? (
              <p className="text-sm text-muted-foreground">
                {mode.description}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {durationLabel(mode.durationMinutes)}
            </p>
          </div>
          {mode.disabled && mode.disabledReason ? (
            <p className="text-sm text-destructive">
              {reasonCopy[mode.disabledReason]}
              {alternativeHint ? ` ${alternativeHint}` : null}
            </p>
          ) : null}
        </Radio>
      ))}
    </RadioGroup>
  )
}

function ModeIcon({ kind }: { kind: BookingModeKind }): ReactNode {
  switch (kind) {
    case "online":
      return <VideoCameraIcon className="size-5" weight="duotone" />
    case "phone":
      return <PhoneIcon className="size-5" weight="duotone" />
    case "in_person":
      return <MapPinIcon className="size-5" weight="duotone" />
    default: {
      const _exhaustive: never = kind
      return <MonitorIcon className="size-5" weight="duotone" />
    }
  }
}
