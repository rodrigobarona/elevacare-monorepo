import type * as React from "react"
import { ArrowRightIcon, ShieldCheckIcon } from "@eleva/icons"
import { cn } from "@eleva/ui/lib/utils"

type LinkComponent = React.ElementType<{
  href: string
  className?: string
  children?: React.ReactNode
}>

/**
 * One frame for every expert portrait: a sand field, with the person set at
 * the top. A photograph cut out of its background shows the sand through
 * it, so a row of portraits reads as one set; one that has not been cut out
 * fills the same frame.
 */
const expertPortraitFrame =
  "overflow-hidden rounded-xl bg-coral-100 [&_img]:object-cover [&_img]:object-top"

export type ExpertCardFact = { label: React.ReactNode; value: React.ReactNode }

/**
 * The expert, in the public site's voice: portrait, what she says about her
 * work, who she is, and the facts a member compares. The name anchor
 * stretches over the card, so the whole card is one link and one tab stop.
 * Phones get a compact card (small portrait beside the name) so a short list
 * does not take eight screens.
 */
function ExpertCard({
  media,
  name,
  headline,
  badge,
  checkedLabel,
  meta,
  facts = [],
  action,
  href,
  linkAs: LinkAs = "a",
  className,
  ...props
}: {
  media: React.ReactNode
  name: React.ReactNode
  /** The expert's own line about her work, set as speech. */
  headline?: React.ReactNode
  /** Short highlight shown over the portrait, e.g. "Top Expert". */
  badge?: React.ReactNode
  /** "Registration checked": Eleva checked this expert's registration. */
  checkedLabel?: React.ReactNode
  /** One quiet line under the name, e.g. areas of care. */
  meta?: React.ReactNode
  /** Up to two labelled facts, e.g. languages and price. */
  facts?: readonly ExpertCardFact[]
  /** What the card opens, in words, e.g. "See profile". */
  action?: React.ReactNode
  href: string
  linkAs?: LinkComponent
  className?: string
} & Omit<React.ComponentProps<"article">, "children">) {
  return (
    <article
      data-slot="expert-card"
      className={cn(
        "group relative grid h-full grid-cols-[5.5rem_minmax(0,1fr)] content-start gap-x-4 rounded-3xl border bg-card p-3.5 transition-colors focus-within:ring-3 focus-within:ring-ring/50 hover:border-foreground/40 sm:flex sm:flex-col",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          expertPortraitFrame,
          "relative aspect-square sm:aspect-[18/19]"
        )}
      >
        {media}
        {badge ? (
          <span className="absolute top-3 left-3 hidden rounded-full bg-background/90 px-3 py-1 text-sm font-medium text-foreground backdrop-blur sm:inline">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="self-center sm:order-2 sm:mt-5 sm:self-auto sm:px-2.5">
        <h3 className="text-lg font-medium">
          <LinkAs
            href={href}
            className="outline-none after:absolute after:inset-0 after:rounded-3xl"
          >
            {name}
          </LinkAs>
        </h3>
        {meta ? (
          <p className="text-base text-muted-foreground">{meta}</p>
        ) : null}
        {checkedLabel ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-base">
            <ShieldCheckIcon
              aria-hidden
              weight="fill"
              className="mt-1 size-4 shrink-0"
            />
            {checkedLabel}
          </p>
        ) : null}
        {/* On phones the photo is small: the paid placement shows here,
            styled apart so it never reads as part of the check. */}
        {badge ? (
          <p className="mt-1.5 sm:hidden">
            <span className="rounded-full border px-2.5 py-0.5 text-sm font-medium text-foreground">
              {badge}
            </span>
          </p>
        ) : null}
      </div>
      {headline ? (
        <p className="col-span-2 mt-4 line-clamp-3 font-display text-xl leading-snug tracking-tight text-pretty sm:order-1 sm:mt-5 sm:min-h-[4.2em] sm:px-2.5">
          {headline}
        </p>
      ) : null}
      <div className="col-span-2 mt-4 flex flex-col sm:order-3 sm:mx-2.5 sm:mt-auto sm:pt-5">
        {facts.length > 0 ? (
          <dl className="grid grid-cols-2 gap-4 border-t py-3.5 text-base">
            {facts.map((fact, index) => (
              <div key={index}>
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd className="font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {action ? (
          <p
            aria-hidden
            className="flex min-h-12 items-center gap-1.5 border-t pt-1 text-lg font-medium text-primary group-hover:underline group-hover:underline-offset-[5px]"
          >
            {action}
            <ArrowRightIcon className="size-4.5" />
          </p>
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
        "[container-type:inline-size] flex size-full items-center justify-center bg-linear-to-br from-sand-50 via-sand-100 to-teal-50 dark:from-teal-950 dark:via-neutral-900 dark:to-teal-950",
        className
      )}
    >
      <span className="flex aspect-square w-[min(45%,8rem)] items-center justify-center rounded-full border border-teal-200 bg-background/70 font-display text-[clamp(1.25rem,12cqw,2.5rem)] text-teal-800 dark:border-teal-800 dark:text-teal-200">
        {initials}
      </span>
    </div>
  )
}

export { ExpertCard, ExpertCardInitials, expertPortraitFrame }
