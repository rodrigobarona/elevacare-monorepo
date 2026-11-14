"use client"

import { useId, type ReactNode } from "react"
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
  isInvalid,
  errorId,
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
  /** Marked when the member tried to continue without this required tick. */
  isInvalid?: boolean
  /** The visible error that explains an invalid tick, read with it. */
  errorId?: string
  className?: string
}) {
  const descriptionId = useId()
  return (
    <div data-testid={`booking-consent-${id}`}>
      <CheckboxField
        id={id}
        isSelected={isSelected}
        onChange={onChange}
        isInvalid={isInvalid}
        aria-describedby={
          [description ? descriptionId : null, isInvalid ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        // The box sits on the first line of a relaxed 14px label.
        className={cn(
          "items-start [&>[data-slot=checkbox]]:mt-[3px]",
          className
        )}
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
                  className="font-medium text-primary underline underline-offset-4"
                >
                  {linkLabel}
                </a>
              </>
            ) : null}
          </span>
        }
      />
      {description ? (
        // Aligned with the label: a 16px box plus the 8px field gap.
        <p
          id={descriptionId}
          className="mt-1 ml-6 text-sm text-muted-foreground"
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
