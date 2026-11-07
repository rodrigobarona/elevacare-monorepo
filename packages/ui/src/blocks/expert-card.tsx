import type * as React from "react"
import { cn } from "@eleva/ui/lib/utils"

type LinkComponent = React.ElementType<{
  href: string
  className?: string
  children?: React.ReactNode
}>

/**
 * Portrait-led marketplace card. The name anchor stretches over the card, so
 * the whole card is one link and one tab stop. Phones get a horizontal card
 * (small portrait beside the text) so a short list does not take eight
 * screens; from `sm` up the portrait sits on top.
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
  /** One quiet line under the headline, e.g. areas of care. */
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
        "group relative flex h-full flex-row gap-4 overflow-hidden rounded-3xl border bg-card p-3 shadow-1 transition-shadow duration-(--duration-base) focus-within:ring-3 focus-within:ring-ring/50 hover:shadow-2 sm:flex-col sm:gap-0 sm:p-0",
        className
      )}
      {...props}
    >
      <div className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-2xl bg-muted sm:w-full sm:rounded-none [&_img]:object-cover [&_img]:transition-transform [&_img]:duration-(--duration-slower) [&_img]:ease-out motion-safe:group-hover:[&_img]:scale-[1.03]">
        {media}
        {badge ? (
          <span className="absolute top-3 left-3 hidden rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-primary shadow-1 backdrop-blur sm:inline">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1 sm:gap-2 sm:p-5">
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
        <h3 className="font-display text-lg leading-tight font-medium tracking-tight sm:text-xl">
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
          <p className="mt-auto pt-1 text-sm text-pretty">
            {meta ? (
              <span className="text-muted-foreground">{meta}</span>
            ) : null}
            {meta && price ? (
              <span aria-hidden className="text-muted-foreground">
                {" · "}
              </span>
            ) : null}
            {price ? (
              <span className="font-medium whitespace-nowrap text-foreground">
                {price}
              </span>
            ) : null}
          </p>
        ) : null}
        {badge ? (
          <p className="text-xs font-medium text-primary sm:hidden">{badge}</p>
        ) : null}
      </div>
    </article>
  )
}

/**
 * Calm monogram for experts without a portrait: a light brand tint with a
 * small serif monogram, so a missing photo never reads as a loud placeholder.
 */
function ExpertCardInitials({
  initials,
  className,
}: {
  initials: string
  className?: string
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-full items-center justify-center bg-linear-to-br from-sand-50 via-sand-100 to-teal-50 dark:from-teal-950 dark:via-neutral-900 dark:to-teal-950",
        className
      )}
    >
      <span className="[container-type:inline-size] flex aspect-square w-[min(45%,8rem)] items-center justify-center rounded-full border border-teal-200 bg-background/70 font-display text-[clamp(1.25rem,6cqw,2.5rem)] text-teal-800 dark:border-teal-800 dark:text-teal-200">
        {initials}
      </span>
    </div>
  )
}

export { ExpertCard, ExpertCardInitials }
