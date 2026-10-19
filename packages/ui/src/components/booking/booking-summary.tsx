import type { ReactNode } from "react"
import { PriceTag } from "@eleva/ui/components/booking/price-tag"
import { cn } from "@eleva/ui/lib/utils"

export function BookingSummary({
  expertName,
  offerTitle,
  media,
  when,
  whenLabel,
  priceLabel,
  modeLabel,
  modeValue,
  location,
  priceCents,
  locale,
  specialPrice = false,
  specialPriceLabel,
  holdLabel,
  footer,
  className,
}: {
  expertName: string
  offerTitle: string
  /** Expert avatar or portrait shown beside the offer title. */
  media?: ReactNode
  when: string
  whenLabel: string
  priceLabel: string
  modeLabel: string
  modeValue: string
  location?: string
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
        "self-start rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5 lg:sticky lg:top-24",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {media ? <div className="shrink-0">{media}</div> : null}
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{expertName}</p>
          <h2 className="mt-0.5 font-display text-xl leading-tight font-medium text-balance">
            {offerTitle}
          </h2>
        </div>
      </div>
      <dl className="mt-5 divide-y divide-border border-t border-border text-sm">
        <div className="flex justify-between gap-3 py-3">
          <dt className="text-muted-foreground">{modeLabel}</dt>
          <dd className="text-right font-medium">{location ?? modeValue}</dd>
        </div>
        <div className="flex justify-between gap-3 py-3">
          <dt className="text-muted-foreground">{whenLabel}</dt>
          <dd className="text-right font-medium">{when}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 pt-3">
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
        <div className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </aside>
  )
}
