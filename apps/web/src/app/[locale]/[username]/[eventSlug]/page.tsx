import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { isReserved } from "@eleva/config/reserved-usernames"
import { BookingFunnel } from "@/components/booking/booking-funnel"
import { BookingLayout } from "@/components/booking/booking-layout"
import { PublicRateLimited } from "@/components/public-rate-limited"
import { funnelConsentDocs } from "@/lib/booking-consents"
import { readBookingGeo } from "@/lib/booking-geo"
import { hreflangLanguages, localePath } from "@/lib/hreflang"
import { isSupportedLocale, pickLocalizedText } from "@/lib/localized-text"
import {
  getPublicEventType,
  getPublicExpert,
  isNotFoundApiError,
  isRateLimitedApiError,
} from "@/lib/public-api"

type Props = {
  params: Promise<{ locale: string; username: string; eventSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, username, eventSlug } = await params
  if (isReserved(username)) return {}
  try {
    const [eventType, expert] = await Promise.all([
      getPublicEventType(username, eventSlug),
      getPublicExpert(username),
    ])
    const t = await getTranslations({ locale, namespace: "booking" })
    const title = pickLocalizedText(eventType.title, locale)
    const path = `/${username}/${eventSlug}`
    return {
      title: t("meta.title", { offer: title, name: expert.displayName }),
      description: t("meta.description", {
        offer: title,
        name: expert.displayName,
      }),
      alternates: {
        canonical: localePath(locale, path),
        languages: hreflangLanguages(path),
      },
    }
  } catch {
    return {}
  }
}

export default async function PublicBookingPage({ params }: Props) {
  const { locale, username, eventSlug } = await params
  if (!isSupportedLocale(locale) || isReserved(username)) {
    notFound()
  }
  setRequestLocale(locale)

  const geoPromise = readBookingGeo()

  let eventType
  let expert
  try {
    ;[eventType, expert] = await Promise.all([
      getPublicEventType(username, eventSlug),
      getPublicExpert(username),
    ])
  } catch (error) {
    if (isNotFoundApiError(error)) {
      notFound()
    }
    if (isRateLimitedApiError(error)) {
      const t = await getTranslations("booking")
      return <PublicRateLimited message={t("errors.rateLimited")} />
    }
    throw error
  }

  const geo = await geoPromise

  if (eventType.modes.length === 0) {
    notFound()
  }

  return (
    <BookingLayout backHref={`/${username}`} backLabelKey="expert">
      <BookingFunnel
        locale={locale}
        expertName={expert.displayName}
        username={expert.username}
        eventSlug={eventType.slug}
        title={eventType.title}
        modes={eventType.modes}
        cancellationPolicy={eventType.cancellationPolicy}
        geoCountry={geo.country}
        geoTimeZone={geo.timeZone}
        consents={funnelConsentDocs(locale)}
      />
    </BookingLayout>
  )
}
