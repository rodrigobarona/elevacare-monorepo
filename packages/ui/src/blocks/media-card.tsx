import type * as React from "react"
import { ArrowRightIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

type LinkComponent = React.ElementType<{
  href: string
  className?: string
  children?: React.ReactNode
}>

/**
 * Photo-led card. When `href` is set the whole card is one link (the title
 * anchor stretches over the card), so there is a single tab stop.
 */
function MediaCard({
  media,
  eyebrow,
  title,
  description,
  href,
  actionLabel,
  linkAs: LinkAs = "a",
  aspect = "portrait",
  className,
}: {
  media: React.ReactNode
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  href?: string
  actionLabel?: React.ReactNode
  linkAs?: LinkComponent
  aspect?: "portrait" | "landscape" | "square"
  className?: string
}) {
  return (
    <article
      data-slot="media-card"
      className={cn(
        "group relative flex flex-col gap-4 rounded-3xl",
        href && "focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl bg-muted shadow-1",
          aspect === "portrait" && "aspect-[4/5]",
          aspect === "landscape" && "aspect-[4/3]",
          aspect === "square" && "aspect-square",
          "[&_img]:object-cover [&_img]:transition-transform [&_img]:duration-(--duration-slower) [&_img]:ease-out",
          href && "group-hover:[&_img]:scale-[1.03]"
        )}
      >
        {media}
      </div>
      <div className="flex flex-col gap-2 px-1">
        {eyebrow ? <p className="eyebrow text-primary">{eyebrow}</p> : null}
        <h3 className="font-display text-2xl leading-tight font-medium tracking-tight">
          {href ? (
            <LinkAs
              href={href}
              className="outline-none after:absolute after:inset-0 after:rounded-3xl"
            >
              {title}
            </LinkAs>
          ) : (
            title
          )}
        </h3>
        {description ? (
          <p className="text-pretty text-muted-foreground">{description}</p>
        ) : null}
        {href && actionLabel ? (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            {actionLabel}
            <ArrowRightIcon className="size-4 transition-transform duration-(--duration-base) group-hover:translate-x-0.5" />
          </p>
        ) : null}
      </div>
    </article>
  )
}

export { MediaCard }
