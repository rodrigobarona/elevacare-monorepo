import type * as React from "react"
import { cn } from "@eleva/ui/lib/utils"
import { Eyebrow, Heading, Lead } from "@eleva/ui/components/typography"

/**
 * Closing call to action. One per page: warm gradient by default, or a split
 * layout with a photo when `media` is set.
 */
function CtaBand({
  eyebrow,
  title,
  lead,
  actions,
  media,
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  lead?: React.ReactNode
  actions: React.ReactNode
  media?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="cta-band"
      className={cn(
        "relative isolate overflow-hidden rounded-3xl bg-teal-900 text-white lg:rounded-4xl",
        media ? "grid lg:grid-cols-2" : "",
        className
      )}
    >
      {media ? null : (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_110%_-10%,var(--color-coral-400),transparent_60%),radial-gradient(40rem_24rem_at_-10%_120%,var(--color-teal-500),transparent_60%)] opacity-60"
        />
      )}
      <div className="flex flex-col gap-5 px-6 py-14 sm:px-12 sm:py-20">
        {eyebrow ? <Eyebrow tone="inverse">{eyebrow}</Eyebrow> : null}
        <Heading size="headline" tone="inverse" className="max-w-xl">
          {title}
        </Heading>
        {lead ? <Lead className="max-w-lg text-white/80">{lead}</Lead> : null}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">{actions}</div>
      </div>
      {media ? (
        <div className="relative min-h-72 [&_img]:object-cover">{media}</div>
      ) : null}
    </div>
  )
}

export { CtaBand }
