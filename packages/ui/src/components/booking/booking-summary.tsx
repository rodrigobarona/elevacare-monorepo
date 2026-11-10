import type { ReactNode } from "react"
import { PriceTag } from "@eleva/ui/components/booking/price-tag"
import { cn } from "@eleva/ui/lib/utils"

/**
 * Who the member is booking, on every step: the expert (photo, name,
 * headline, a way back to their page) and the session. Beside the steps on
 * desktop; on phones a compact header above them (name, session, price,
 * and the time once picked), so the steps start near the top.
 */
export function BookingSummary({
  expertName,
  expertHeadline,
  profileLink,
  offerTitle,
  meta,
  media,
  when,
  whenPending = false,
  whenLabel,
  priceLabel,
  priceCents,
  locale,
  specialPrice = false,
  specialPriceLabel,
  holdLabel,
  footer,
  className,
}: {
  expertName: string
  /** e.g. "Physiotherapist · Lisbon". */
  expertHeadline?: string | null
  /** Link back to the expert's page, rendered by the app's router. */
  profileLink?: ReactNode
  offerTitle: string
  /** One line under the offer: duration and how they meet, e.g. "60 min · Video call". */
  meta?: string
  /** Expert avatar or portrait shown beside the offer title. */
  media?: ReactNode
  when: string
  /** No time picked yet: phones skip the "When" row (the step says it). */
  whenPending?: boolean
  whenLabel: string
  priceLabel: string
  priceCents: number
  locale: string
  specialPrice?: boolean
  specialPriceLabel?: string
  holdLabel?: string
  footer?: ReactNode
  className?: string
}) {
  return (
    <aside
      data-slot="booking-summary"
      className={cn(
        "self-start rounded-3xl bg-card p-4 shadow-md ring-1 ring-foreground/5 lg:sticky lg:top-24 lg:rounded-4xl lg:p-6",
        className
      )}
    >
      <div className="flex items-center gap-3 lg:gap-4">
        {media ? (
          <div className="shrink-0 *:size-10 lg:*:size-14">{media}</div>
        ) : null}
        <div className="min-w-0">
          <p className="truncate font-medium">{expertName}</p>
          {/* Phones keep the summary to a few lines: name and the way back. */}
          {expertHeadline ? (
            <p className="hidden text-sm text-muted-foreground lg:line-clamp-2">
              {expertHeadline}
            </p>
          ) : null}
          {profileLink ? (
            <div className="mt-0.5 text-sm">{profileLink}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-3 lg:mt-4 lg:pt-4">
        <h2 className="font-display text-lg leading-tight font-medium text-balance lg:text-xl">
          {offerTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {meta}
          {/* Phones: the price joins this line instead of its own row. */}
          <span className="font-medium text-foreground lg:hidden">
            {meta ? " · " : null}
            <PriceTag
              cents={priceCents}
              locale={locale}
              special={specialPrice}
              specialLabel={specialPriceLabel}
            />
          </span>
        </p>
      </div>
      <dl
        className={cn(
          "mt-3 divide-y divide-border border-t border-border text-sm lg:mt-4",
          whenPending && "hidden lg:block"
        )}
      >
        <div className="flex justify-between gap-3 pt-3 lg:pb-3">
          <dt className="text-muted-foreground">{whenLabel}</dt>
          <dd className="text-right font-medium">{when}</dd>
        </div>
        {/* Phones show the price in the line above. */}
        <div className="hidden items-baseline justify-between gap-3 pt-3 lg:flex">
          <dt className="text-muted-foreground">{priceLabel}</dt>
          <dd className="text-right text-base font-semibold">
            <PriceTag
              cents={priceCents}
              locale={locale}
              special={specialPrice}
              specialLabel={specialPriceLabel}
            />
          </dd>
        </div>
      </dl>
      {holdLabel ? (
        <p className="mt-5 rounded-2xl bg-primary/8 px-4 py-2.5 text-sm font-medium text-primary">
          {holdLabel}
        </p>
      ) : null}
      {footer ? (
        <div className="mt-5 hidden border-t border-border pt-4 text-sm text-muted-foreground lg:block">
          {footer}
        </div>
      ) : null}
    </aside>
  )
}
