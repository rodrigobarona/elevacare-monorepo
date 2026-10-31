import type * as React from "react"
import { ArrowRightIcon, ArrowUpRightIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

type LinkComponent = React.ElementType<{
  href: string
  className?: string
  children?: React.ReactNode
}>

/**
 * Photo-led card. When `href` is set the whole card is one link (the title
 * anchor stretches over the card), so there is a single tab stop. The
 * `overlay` variant sets the title on the photo; `aspect="fill"` follows the
 * height of the parent.
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
  variant = "default",
  className,
}: {
  media: React.ReactNode
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  href?: string
  actionLabel?: React.ReactNode
  linkAs?: LinkComponent
  aspect?: "portrait" | "landscape" | "square" | "fill"
  variant?: "default" | "overlay"
  className?: string
}) {
  const heading = href ? (
    <LinkAs
      href={href}
      className="outline-none after:absolute after:inset-0 after:rounded-3xl"
    >
      {title}
    </LinkAs>
  ) : (
    title
  )

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
          aspect === "fill" && "h-full",
          "[&_img]:object-cover [&_img]:transition-transform [&_img]:duration-(--duration-slower) [&_img]:ease-out",
          href && "group-hover:[&_img]:scale-[1.03]"
        )}
      >
        {media}
        {variant === "overlay" ? (
          <>
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-teal-950/80 to-transparent"
            />
            {href ? (
              <span
                aria-hidden
                className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/85 text-teal-950 shadow-1 ring-1 ring-black/10 backdrop-blur-sm transition-transform duration-(--duration-base) group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              >
                <ArrowUpRightIcon className="size-4" />
              </span>
            ) : null}
            <h3 className="absolute inset-x-5 bottom-4 text-lg leading-snug font-medium text-pretty text-white">
              {heading}
            </h3>
          </>
        ) : null}
      </div>
      <div
        className={cn(
          "flex flex-col gap-2 px-1",
          variant === "overlay" && !description && "hidden"
        )}
      >
        {eyebrow ? <p className="eyebrow text-primary">{eyebrow}</p> : null}
        {variant === "default" ? (
          <h3 className="font-display text-2xl leading-tight font-medium tracking-tight">
            {heading}
          </h3>
        ) : null}
        {description ? (
          <p className="text-pretty text-muted-foreground">{description}</p>
        ) : null}
        {variant === "default" && href && actionLabel ? (
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
