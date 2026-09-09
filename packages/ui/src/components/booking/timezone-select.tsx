"use client"

import { Label } from "@eleva/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import { cn } from "@eleva/ui/lib/utils"

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

export function TimezoneSelect({
  value,
  onChange,
  label,
  className,
}: {
  value: string
  onChange: (tz: string) => void
  label: string
  className?: string
}) {
  const zones = listTimeZones()
  const selected = resolvedTimeZone(value)

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <Label>{label}</Label>
      <Select
        selectedKey={selected}
        onSelectionChange={(key) => {
          if (typeof key === "string") onChange(key)
        }}
        className="w-full"
        aria-label={label}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {zones.map((zone) => (
            <SelectItem key={zone} id={zone} textValue={zone}>
              {zone.replaceAll("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
