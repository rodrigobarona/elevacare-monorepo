import type * as React from "react"
import { cn } from "@eleva/ui/lib/utils"
import { Container } from "@eleva/ui/blocks/section"
import { Heading } from "@eleva/ui/components/typography"

/**
 * The closing block: a full-width coral field with one thing to do next.
 * One per page, as its last section. Coral is used nowhere else on the
 * page, so the ending is recognisable. Text on it is always ink.
 *
 * `aside` adds a second, quieter door beside the first (for example the
 * professional's way in beside the member's).
 */
function CtaBand({
  title,
  lead,
  actions,
  aside,
  className,
}: {
  title: React.ReactNode
  lead?: React.ReactNode
  actions: React.ReactNode
  aside?: React.ReactNode
  className?: string
}) {
  return (
    <section
      data-slot="cta-band"
      className={cn(
        "bg-coral-400 px-4 py-18 text-neutral-950 sm:px-6 sm:py-24",
        className
      )}
    >
      <Container
        className={cn(
          aside && "grid items-end gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-18"
        )}
      >
        <div>
          <Heading size="headline" className="max-w-xl text-neutral-950">
            {title}
          </Heading>
          {lead ? (
            <p className="mt-3.5 max-w-[26em] text-xl text-pretty">{lead}</p>
          ) : null}
          <div className="mt-7 flex flex-col gap-x-6 gap-y-3 sm:flex-row sm:items-center">
            {actions}
          </div>
        </div>
        {aside ? (
          <div className="border-neutral-950/40 max-lg:border-t max-lg:pt-8 lg:border-l lg:pl-10">
            {aside}
          </div>
        ) : null}
      </Container>
    </section>
  )
}

/** A quiet link for the closing block: underlined ink, never a second button. */
const ctaBandLinkClass =
  "inline-flex min-h-11 items-center font-medium text-neutral-950 underline decoration-[1.5px] underline-offset-[5px]"

export { CtaBand, ctaBandLinkClass }
