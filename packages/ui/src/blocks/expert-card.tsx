import type * as React from "react"
import { cn } from "@eleva/ui/lib/utils"

type LinkComponent = React.ElementType<{
  href: string
  className?: string
  children?: React.ReactNode
}>

/**
 * Portrait-led marketplace card. The name anchor stretches over the card, so
 * the whole card is one link and one tab stop.
 */
function ExpertCard({
  media,
  name,
  headline,
  badge,
  tags,
  meta,
  price,
  href,
  linkAs: LinkAs = "a",
  className,
  ...props
}: {
  media: React.ReactNode
  name: React.ReactNode
  headline?: React.ReactNode
  /** Short highlight shown over the portrait, e.g. "Top Expert". */
  badge?: React.ReactNode
  tags?: readonly React.ReactNode[]
  meta?: React.ReactNode
  price?: React.ReactNode
  href: string
  linkAs?: LinkComponent
  className?: string
} & Omit<React.ComponentProps<"article">, "children">) {
  return (
    <article
      data-slot="expert-card"
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-1 transition-shadow duration-(--duration-base) focus-within:ring-3 focus-within:ring-ring/50 hover:shadow-2",
        className
      )}
      {...props}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted [&_img]:object-cover [&_img]:transition-transform [&_img]:duration-(--duration-slower) [&_img]:ease-out group-hover:[&_img]:scale-[1.03]">
        {media}
        {badge ? (
          <span className="absolute top-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-primary shadow-1 backdrop-blur">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        {tags && tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((tag, index) => (
              <li
                key={index}
                className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs text-teal-800 dark:bg-teal-950 dark:text-teal-200"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        <h3 className="font-display text-xl leading-tight font-medium tracking-tight">
          <LinkAs
            href={href}
            className="outline-none after:absolute after:inset-0 after:rounded-3xl"
          >
            {name}
          </LinkAs>
        </h3>
        {headline ? (
          <p className="line-clamp-2 text-sm text-pretty text-muted-foreground">
            {headline}
          </p>
        ) : null}
        {meta || price ? (
          <div className="mt-auto flex items-end justify-between gap-3 border-t pt-3 text-sm">
            {meta ? <p className="text-muted-foreground">{meta}</p> : <span />}
            {price ? (
              <p className="shrink-0 font-medium text-foreground">{price}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}

/** Large initials tile for experts without a portrait. */
function ExpertCardInitials({
  initials,
  style,
  className,
}: {
  initials: string
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "flex size-full items-center justify-center font-display text-5xl text-white",
        className
      )}
    >
      {initials}
    </div>
  )
}

export { ExpertCard, ExpertCardInitials }
