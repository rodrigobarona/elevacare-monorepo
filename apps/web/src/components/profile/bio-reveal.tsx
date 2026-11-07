"use client"

import { useId, useState, type ReactNode } from "react"
import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"

/**
 * Long bios start clipped with "Read more". The server decides whether a
 * bio is long enough to need this, so nothing is measured on the client
 * and the layout never shifts.
 */
export function BioReveal({
  children,
  moreLabel,
  lessLabel,
}: {
  children: ReactNode
  moreLabel: string
  lessLabel: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const contentId = useId()
  return (
    <div className="flex flex-col items-start gap-3">
      <div
        id={contentId}
        className={cn(
          "relative w-full",
          !isOpen &&
            "max-h-[13lh] overflow-hidden mask-b-from-60% mask-b-to-100%"
        )}
      >
        {children}
      </div>
      <Button
        variant="link"
        className="h-11 px-0"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onPress={() => setIsOpen((open) => !open)}
      >
        {isOpen ? lessLabel : moreLabel}
      </Button>
    </div>
  )
}
