"use client"

import { useMemo } from "react"
import { Label } from "@eleva/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eleva/ui/components/select"
import {
  countryOptions,
  normalizeCountry,
} from "@eleva/ui/lib/booking/countries"
import { cn } from "@eleva/ui/lib/utils"

const NO_EXTRA_CODES: readonly string[] = []

export function CountrySelect({
  value,
  onChange,
  locale,
  extraCodes = NO_EXTRA_CODES,
  label,
  description,
  className,
}: {
  value: string
  onChange: (code: string) => void
  locale: string
  extraCodes?: readonly string[]
  label: string
  description?: string
  className?: string
}) {
  const options = useMemo(
    () => countryOptions(locale, extraCodes),
    [locale, extraCodes]
  )
  const selected = normalizeCountry(value)

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <Label>{label}</Label>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
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
          {options.map((option) => (
            <SelectItem
              key={option.code}
              id={option.code}
              textValue={option.label}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
