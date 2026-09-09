import { PriceTag } from "@eleva/ui/components/booking/price-tag"
import { cn } from "@eleva/ui/lib/utils"

export function BookingSummary({
  expertName,
  offerTitle,
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
  className,
}: {
  expertName: string
  offerTitle: string
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
  className?: string
}) {
  return (
    <aside
      data-slot="booking-summary"
      className={cn(
        "rounded-4xl bg-card p-5 shadow-md ring-1 ring-foreground/5",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{expertName}</p>
      <h2 className="mt-1 font-heading text-lg font-medium">{offerTitle}</h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{modeLabel}</dt>
          <dd className="text-right">{location ?? modeValue}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{whenLabel}</dt>
          <dd className="text-right">{when}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{priceLabel}</dt>
          <dd className="text-right">
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
        <p className="mt-4 text-sm font-medium text-primary">{holdLabel}</p>
      ) : null}
    </aside>
  )
}
