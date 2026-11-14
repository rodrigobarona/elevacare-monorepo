"use client"

import type { ReactNode } from "react"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import { cn } from "@eleva/ui/lib/utils"

/**
 * One consent: a required or optional tick with its statement, an optional
 * plain explanation under it, and links that open in a new tab.
 */
export function ConsentCheckbox({
  id,
  isSelected,
  onChange,
  label,
  href,
  linkLabel,
  description,
  className,
}: {
  id: string
  isSelected: boolean
  onChange: (selected: boolean) => void
  /** The statement; may carry its own links. */
  label: ReactNode
  /** A trailing link after the statement (older single-link form). */
  href?: string
  linkLabel?: string
  /** A short, plain line under the statement. */
  description?: ReactNode
  className?: string
}) {
  return (
    <div data-testid={`booking-consent-${id}`}>
      <CheckboxField
        id={id}
        isSelected={isSelected}
        onChange={onChange}
        className={cn("items-start", className)}
        label={
          <span className="text-sm leading-relaxed">
            {label}
            {href && linkLabel ? (
              <>
                {" "}
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {linkLabel}
                </a>
              </>
            ) : null}
          </span>
        }
      />
      {description ? (
        <p className="mt-1 ml-7 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
