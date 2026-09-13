import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { BookingFunnel } from "@/components/booking/booking-funnel"
import { BookingLayout } from "@/components/booking/booking-layout"
import { PublicRateLimited } from "@/components/public-rate-limited"
import { funnelConsentDocs } from "@/lib/booking-consents"
import { readBookingGeo } from "@/lib/booking-geo"
import { isSupportedLocale, pickLocalizedText } from "@/lib/localized-text"
import { getPublicBookingLink, isRateLimitedApiError } from "@/lib/public-api"

type Props = {
  params: Promise<{ locale: string; token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, token } = await params
  if (!isSupportedLocale(locale)) {
    return { robots: { index: false, follow: false } }
  }
  try {
    const link = await getPublicBookingLink(token)
    const t = await getTranslations({ locale, namespace: "booking" })
    return {
      title: t("meta.linkTitle", {
        offer: pickLocalizedText(link.eventTitle, locale),
        name: link.expertDisplayName,
      }),
      robots: { index: false, follow: false },
    }
  } catch {
    return { robots: { index: false, follow: false } }
  }
}

export default async function PrivateBookingPage({ params }: Props) {
  const { locale, token } = await params
  if (!isSupportedLocale(locale)) {
    notFound()
  }
  setRequestLocale(locale)

  const geoPromise = readBookingGeo()

  let link
  try {
    link = await getPublicBookingLink(token)
  } catch (error) {
    if (isRateLimitedApiError(error)) {
      const t = await getTranslations("booking")
      return <PublicRateLimited message={t("errors.rateLimited")} />
    }
    notFound()
  }

  const geo = await geoPromise

  return (
    <BookingLayout backHref="/experts">
      <BookingFunnel
        locale={locale}
        expertName={link.expertDisplayName}
        username={link.username}
        eventSlug={link.eventSlug}
        title={link.eventTitle}
        modes={link.modes}
        geoCountry={geo.country}
        geoTimeZone={geo.timeZone}
        consents={funnelConsentDocs(locale)}
        linkToken={token}
        linkNote={link.note}
        specialPriceCents={link.priceCents}
        pinnedModeId={link.eventTypeModeId}
      />
    </BookingLayout>
  )
}
