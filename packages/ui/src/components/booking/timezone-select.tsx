"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ComboBox,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  useFilter,
} from "react-aria-components"
import { Button } from "@eleva/ui/components/button"
import { zoneCity, zoneOffsetLabel } from "@eleva/ui/lib/booking/slot-groups"
import { cn } from "@eleva/ui/lib/utils"
import { CheckIcon, GlobeIcon } from "@eleva/icons"

const FALLBACK_ZONES = [
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "America/Sao_Paulo",
  "America/New_York",
  "UTC",
]

export function listTimeZones(): string[] {
  const supported = Intl.supportedValuesOf?.("timeZone")
  if (supported && supported.length > 0) return [...supported]
  return FALLBACK_ZONES
}

export function resolvedTimeZone(value: string): string {
  return listTimeZones().includes(value) ? value : "Europe/Lisbon"
}

/**
 * "Times in Lisbon time · Change time zone". Change reveals a searchable
 * list (city and UTC offset); focus moves into it and returns to the
 * trigger once a zone is picked or the search is closed with Escape.
 */
export function TimeZoneLine({
  value,
  onChange,
  labels,
  locale,
  className,
}: {
  value: string
  onChange: (timeZone: string) => void
  /** Shows the city in this language ("Lisboa" in Portuguese). */
  locale?: string
  labels: {
    /** "Times in {city} time". */
    timesIn: (city: string) => string
    change: string
    /** "Change time zone, currently {city}". */
    changeAccessible: (city: string) => string
    field: string
    empty: string
  }
  className?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const city = zoneCity(value, locale)

  useEffect(() => {
    if (isEditing || !returnFocus.current) return
    returnFocus.current = false
    triggerRef.current?.focus()
  }, [isEditing])

  function close() {
    returnFocus.current = true
    setIsEditing(false)
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
        <GlobeIcon aria-hidden className="size-4" />
        <span>{labels.timesIn(city)}</span>
        <span aria-hidden>·</span>
        <Button
          ref={triggerRef}
          variant="link"
          className="h-11 px-0 text-sm"
          aria-label={labels.changeAccessible(city)}
          aria-expanded={isEditing}
          onPress={() => setIsEditing((open) => !open)}
        >
          {labels.change}
        </Button>
      </p>
      {isEditing ? (
        <ZoneComboBox
          value={value}
          label={labels.field}
          empty={labels.empty}
          onPick={(zone) => {
            onChange(zone)
            close()
          }}
          onDismiss={close}
        />
      ) : null}
    </div>
  )
}

function ZoneComboBox({
  value,
  label,
  empty,
  onPick,
  onDismiss,
}: {
  value: string
  label: string
  empty: string
  onPick: (zone: string) => void
  onDismiss: () => void
}) {
  const { contains } = useFilter({ sensitivity: "base" })
  const zones = useMemo(() => {
    const now = new Date()
    return listTimeZones().map((zone) => {
      const offset = zoneOffsetLabel(zone, now)
      const name = zone.replaceAll("_", " ")
      return { id: zone, city: zoneCity(zone), offset, name }
    })
  }, [])

  return (
    <ComboBox
      className="flex max-w-sm flex-col gap-1.5"
      defaultItems={zones}
      // Starts empty so the member types a city straight away.
      defaultInputValue=""
      menuTrigger="focus"
      // Keep the list open on a search with no match so it can say so.
      allowsEmptyCollection
      defaultFilter={(text, input) => contains(text, input)}
      onSelectionChange={(key) => {
        if (typeof key === "string") onPick(key)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDismiss()
      }}
    >
      <Label className="text-sm font-medium">{label}</Label>
      <Input
        autoFocus
        className="h-11 w-full rounded-full border border-input-border bg-background px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Popover className="max-h-72 w-(--trigger-width) overflow-y-auto rounded-3xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
        <ListBox
          className="outline-none"
          renderEmptyState={() => (
            <p className="px-3 py-2 text-sm text-muted-foreground">{empty}</p>
          )}
        >
          {(zone: (typeof zones)[number]) => (
            <ListBoxItem
              id={zone.id}
              textValue={`${zone.name} ${zone.offset}`}
              className="flex min-h-11 cursor-default items-center justify-between gap-3 rounded-2xl px-3 text-sm outline-none data-focused:bg-accent data-focused:text-accent-foreground"
            >
              <>
                <span className="truncate">
                  {zone.city}
                  <span className="ml-2 text-muted-foreground">
                    {zone.name}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-muted-foreground tabular-nums">
                  {zone.offset}
                  {zone.id === value ? (
                    <CheckIcon aria-hidden className="size-4" />
                  ) : null}
                </span>
              </>
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  )
}
