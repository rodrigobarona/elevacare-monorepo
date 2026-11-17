"use client"

import { useId, useState, type ReactNode } from "react"
import { Button } from "@eleva/ui/components/button"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@eleva/ui/components/dialog"
import { cn } from "@eleva/ui/lib/utils"

/**
 * One consent: a required or optional tick with its statement, an optional
 * plain explanation under it, and links that open in a new tab. Anything
 * more (how to withdraw, the notice) goes in `details`: a "Details" link
 * that opens a dialog, so the statement and its purpose stay on the page
 * and the rest is one tap away (a layered notice).
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
  details,
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
  /** More about this consent, in a dialog opened from a "Details" link. */
  details?: {
    /** Visible link text, e.g. "Details". */
    trigger: string
    /** Accessible name, e.g. "Details: your health information". */
    triggerLabel: string
    title: string
    content: ReactNode
    close: string
  }
  className?: string
}) {
  const descriptionId = useId()
  const [open, setOpen] = useState(false)
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
      {description || details ? (
        // Aligned with the label: a 16px box plus the 8px field gap.
        <p className="mt-1 ml-6 text-sm text-muted-foreground">
          {description ? <span id={descriptionId}>{description}</span> : null}
          {description && details ? " " : null}
          {details ? (
            <Button
              variant="link"
              size="sm"
              className="h-auto min-h-6 px-0 align-baseline text-sm text-foreground underline underline-offset-4"
              aria-label={details.triggerLabel}
              onPress={() => setOpen(true)}
              data-testid={`booking-consent-${id}-details`}
            >
              {details.trigger}
            </Button>
          ) : null}
        </p>
      ) : null}
      {details ? (
        <Dialog isOpen={open} onOpenChange={setOpen} showCloseButton={false}>
          <div className="grid gap-5">
            <DialogHeader>
              <DialogTitle>{details.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm leading-relaxed">
              {details.content}
            </div>
            <DialogFooter>
              <Button onPress={() => setOpen(false)}>{details.close}</Button>
            </DialogFooter>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}
