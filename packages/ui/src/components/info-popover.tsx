"use client"

import type { ReactNode } from "react"
import { Dialog, DialogTrigger, Heading } from "react-aria-components"
import { InfoIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"
import { Button } from "@eleva/ui/components/button"
import { Popover } from "@eleva/ui/components/popover"

interface InfoPopoverProps {
  /** Names the button for screen readers, e.g. "About two-step verification". */
  label: string
  /** Optional heading inside the popover. */
  title?: string
  children: ReactNode
  className?: string
}

/**
 * Background explanation most people do not need to act: what a passkey
 * is, why we ask for a time zone. Sits after a title or label as a small
 * (i) button; the answer opens in a popover, so the page keeps one line of
 * hint at most. Never hide what someone must know before acting (cost,
 * consequences, legal effect) in here.
 */
function InfoPopover({ label, title, children, className }: InfoPopoverProps) {
  return (
    <DialogTrigger>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        data-slot="info-popover-trigger"
        className={cn(
          "-my-1 rounded-full align-middle text-muted-foreground hover:text-foreground",
          className
        )}
      >
        <InfoIcon aria-hidden />
      </Button>
      <Popover placement="bottom start" className="w-80">
        <Dialog
          aria-label={title ? undefined : label}
          className="flex flex-col gap-1.5 outline-hidden"
        >
          {title ? (
            <Heading slot="title" className="text-sm font-medium">
              {title}
            </Heading>
          ) : null}
          <div className="space-y-2 text-sm text-muted-foreground">
            {children}
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}

export { InfoPopover }
