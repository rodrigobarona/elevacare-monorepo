import { cn } from "@eleva/ui/lib/utils"

type BookingLocale = "pt" | "es" | "en"

const CURRENCY_LOCALES: Record<BookingLocale, string> = {
  pt: "pt-PT",
  es: "es-ES",
  en: "en-IE",
}

const FALLBACK_LOCALE = "en-IE"

const formatterCache = new Map<string, Intl.NumberFormat>()

export function formatBookingPrice(cents: number, locale: string): string {
  const resolved =
    locale === "pt" || locale === "es" || locale === "en"
      ? CURRENCY_LOCALES[locale]
      : FALLBACK_LOCALE
  let formatter = formatterCache.get(resolved)
  if (!formatter) {
    formatter = new Intl.NumberFormat(resolved, {
      style: "currency",
      currency: "EUR",
    })
    formatterCache.set(resolved, formatter)
  }
  return formatter.format(cents / 100)
}

export function PriceTag({
  cents,
  locale,
  special = false,
  specialLabel,
  className,
}: {
  cents: number
  locale: string
  special?: boolean
  specialLabel?: string
  className?: string
}) {
  return (
    <span
      data-slot="price-tag"
      className={cn(
        "inline-flex items-baseline gap-2 font-medium tabular-nums",
        className
      )}
    >
      <span>{formatBookingPrice(cents, locale)}</span>
      {special && specialLabel ? (
        <span
          data-testid="booking-special-price"
          className="text-xs font-medium tracking-wide text-primary uppercase"
        >
          {specialLabel}
        </span>
      ) : null}
    </span>
  )
}
