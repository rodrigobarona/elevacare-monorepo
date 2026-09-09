"use client"

import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { cn } from "@eleva/ui/lib/utils"

export function ConsentCheckbox({
  id,
  isSelected,
  onChange,
  label,
  href,
  linkLabel,
  className,
}: {
  id: string
  isSelected: boolean
  onChange: (selected: boolean) => void
  label: string
  href: string
  linkLabel: string
  className?: string
}) {
  return (
    <CheckboxField
      id={id}
      isSelected={isSelected}
      onChange={onChange}
      className={cn("items-start", className)}
      label={
        <span className="text-sm leading-relaxed">
          {label}{" "}
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {linkLabel}
          </a>
        </span>
      }
    />
  )
}
