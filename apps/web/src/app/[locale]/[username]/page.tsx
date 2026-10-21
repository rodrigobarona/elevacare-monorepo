import { Suspense, type ReactNode } from "react"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type { PublicEventType } from "@eleva/api-client"
import type { Locale } from "@eleva/config/i18n"
import { describeCancellationPolicy } from "@eleva/config/cancellation-policy"
import { isReserved } from "@eleva/config/reserved-usernames"
import {
  ArrowRightIcon,
  CaretRightIcon,
  ClockIcon,
  GlobeIcon,
  MapPinIcon,
  PhoneIcon,
  TranslateIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import { Container, Section } from "@eleva/ui/blocks/section"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Heading } from "@eleva/ui/components/typography"
import {
  displayLanguageLabel,
  displayRegion,
} from "@eleva/ui/lib/booking/display-names"
import { cn } from "@eleva/ui/lib/utils"
import { ExpertPortrait } from "@eleva/ui/blocks/expert-portrait"
import { PublicRateLimited } from "@/components/public-rate-limited"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Link } from "@/i18n/navigation"
import { readBookingGeo } from "@/lib/booking-geo"
import { bookingSelectionHref } from "@/lib/booking-selection"
import { formatEur } from "@/lib/format-eur"
import { formatSlotDateTime } from "@/lib/format-slot-time"
import { hreflangLanguages, localePath } from "@/lib/hreflang"
import { isSupportedLocale, pickLocalizedText } from "@/lib/localized-text"
import { isMarketplaceCategory } from "@/lib/marketplace-categories"
import { isNotFoundApiError, isRateLimitedApiError } from "@/lib/public-api"
import {
  createServerPublicApiClient,
  getPublicExpert,
} from "@/lib/public-api-server"
import {
  pickUpcomingSlotRows,
  type UpcomingModeSlots,
} from "@/lib/upcoming-slots"

type SessionMode = PublicEventType["modes"][number]["mode"]

const MODE_ICONS = {
  online: VideoCameraIcon,
  in_person: MapPinIcon,
  phone: PhoneIcon,
} satisfies Record<SessionMode, unknown>

function publicPlaceLabel(
  location: { name: string; city: string } | null
): string | null {
  if (!location) return null
  if (location.name === location.city) return location.city
  return `${location.name}, ${location.city}`
}

type Props = {
  params: Promise<{ locale: string; username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, username } = await params
  if (isReserved(username)) {
    return {}
  }
  try {
    const expert = await getPublicExpert(username)
    const t = await getTranslations({ locale, namespace: "profile" })
    const path = `/${expert.username}`
    return {
      title: t("title", { name: expert.displayName }),
      description:
        expert.headline ?? t("description", { name: expert.displayName }),
      alternates: {
        canonical: localePath(locale, path),
        languages: hreflangLanguages(path),
      },
    }
  } catch {
    return {}
  }
}

export default async function ExpertProfilePage({ params }: Props) {
  const { locale, username } = await params
  setRequestLocale(locale)

  if (isReserved(username) || !isSupportedLocale(locale)) {
    notFound()
  }

  const geoPromise = readBookingGeo()
  const [t, tExperts] = await Promise.all([
    getTranslations("profile"),
    getTranslations("experts"),
  ])

  let expert
  try {
    expert = await getPublicExpert(username)
  } catch (error) {
    if (isNotFoundApiError(error)) {
      notFound()
    }
    if (isRateLimitedApiError(error)) {
      return <PublicRateLimited message={t("rateLimited")} />
    }
    throw error
  }

  const geo = await geoPromise
  const bookableEvents = expert.eventTypes.filter(
    (eventType) => eventType.modes.length > 0
  )
  const categories = expert.categorySlugs.filter(isMarketplaceCategory)
  const languages = expert.languages
    .map((code) => displayLanguageLabel(code, locale))
    .join(", ")
  const countries = expert.serviceCountries
    .map((code) => displayRegion(code, locale))
    .join(", ")

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Section spacing="compact" className="pt-12 sm:pt-16">
          <Container
            className={cn(
              "grid items-center gap-10",
              expert.avatarUrl &&
                "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
            )}
          >
            <div
              className={cn(
                "relative overflow-hidden bg-muted shadow-2",
                expert.avatarUrl
                  ? "mx-auto aspect-[4/5] w-full max-w-sm rounded-4xl lg:max-w-none"
                  : "size-28 rounded-full"
              )}
            >
              <ExpertPortrait
                displayName={expert.displayName}
                username={expert.username}
                avatarUrl={expert.avatarUrl}
                isPriority
                className={expert.avatarUrl ? undefined : "text-4xl"}
              />
            </div>
            <div className="flex flex-col gap-6">
              {categories.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {categories.map((slug) => (
                    <li key={slug}>
                      <Link
                        href={`/experts/${slug}`}
                        className="inline-flex h-8 items-center rounded-full bg-teal-50 px-3 text-sm text-teal-800 transition-colors hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-200"
                      >
                        {tExperts(`categories.${slug}`)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-col gap-3">
                <h1
                  data-testid="expert-profile-heading"
                  className="font-display text-4xl leading-tight font-medium tracking-tight text-balance sm:text-5xl"
                >
                  {expert.displayName}
                </h1>
                {expert.headline ? (
                  <p className="text-lg text-pretty text-muted-foreground sm:text-xl">
                    {expert.headline}
                  </p>
                ) : null}
              </div>
              <dl className="grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
                {languages ? (
                  <Fact
                    icon={<TranslateIcon />}
                    label={t("languages")}
                    value={languages}
                  />
                ) : null}
                {countries ? (
                  <Fact
                    icon={<GlobeIcon />}
                    label={t("countries")}
                    value={countries}
                  />
                ) : null}
              </dl>
              {bookableEvents.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  <a
                    href="#availability"
                    className={buttonVariants({
                      size: "lg",
                      className: "rounded-full",
                    })}
                  >
                    {t("seeAvailability")}
                    <ArrowRightIcon data-icon="inline-end" />
                  </a>
                  <a
                    href="#offers"
                    className={buttonVariants({
                      size: "lg",
                      variant: "outline",
                      className: "rounded-full",
                    })}
                  >
                    {t("viewOffers")}
                  </a>
                </div>
              ) : null}
            </div>
          </Container>
        </Section>

        <Section spacing="compact" className="pb-24">
          <Container className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
            <div className="flex flex-col gap-14">
              {expert.bio ? (
                <section className="flex flex-col gap-4">
                  <Heading as="h2" size="title">
                    {t("about", { name: expert.displayName })}
                  </Heading>
                  <p className="text-lg leading-relaxed text-pretty whitespace-pre-line text-muted-foreground">
                    {expert.bio}
                  </p>
                </section>
              ) : null}

              <section id="offers" className="flex scroll-mt-24 flex-col gap-5">
                <Heading as="h2" size="title">
                  {t("offers")}
                </Heading>
                <ul className="flex flex-col gap-4">
                  {expert.eventTypes.map((eventType) => (
                    <OfferCard
                      key={eventType.slug}
                      eventType={eventType}
                      username={expert.username}
                      locale={locale}
                      t={t}
                    />
                  ))}
                </ul>
              </section>
            </div>

            <aside
              id="availability"
              className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start"
            >
              <div className="flex flex-col gap-4 rounded-3xl border bg-card p-6 shadow-2">
                <div className="flex flex-col gap-1">
                  <Heading as="h2" size="subtitle">
                    {t("upcoming")}
                  </Heading>
                  <p className="text-sm text-muted-foreground">
                    {t("timeZoneNote", { timeZone: geo.timeZone })}
                  </p>
                </div>
                {bookableEvents.length > 0 ? (
                  <Suspense
                    fallback={
                      <div className="flex flex-col gap-2">
                        {[0, 1, 2].map((row) => (
                          <div
                            key={row}
                            className="h-14 animate-pulse rounded-2xl bg-muted"
                          />
                        ))}
                      </div>
                    }
                  >
                    <UpcomingSlots
                      locale={locale}
                      username={expert.username}
                      eventTypes={bookableEvents}
                      timeZone={geo.timeZone}
                    />
                  </Suspense>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("noSlots")}
                  </p>
                )}
              </div>
            </aside>
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </div>
  )
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200 [&_svg]:size-4">
        {icon}
      </span>
      <div>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="font-medium text-foreground">{value}</dd>
      </div>
    </div>
  )
}

function OfferCard({
  eventType,
  username,
  locale,
  t,
}: {
  eventType: PublicEventType
  username: string
  locale: Locale
  t: Awaited<ReturnType<typeof getTranslations<"profile">>>
}) {
  const prices = eventType.modes.map((mode) => mode.priceCents)
  const minPrice =
    prices.length > 0 ? Math.min(...prices) : eventType.priceAmount
  const modes = [...new Set(eventType.modes.map((mode) => mode.mode))]
  const policy = describeCancellationPolicy(
    eventType.cancellationPolicy,
    locale
  )

  return (
    <li
      id={eventType.slug}
      className="flex flex-col gap-4 rounded-3xl border bg-card p-6 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-xl leading-tight font-medium tracking-tight">
          {pickLocalizedText(eventType.title, locale)}
        </h3>
        <ul className="flex flex-wrap gap-2 text-sm">
          <li className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
            <ClockIcon aria-hidden className="size-4 text-muted-foreground" />
            {t("duration", { duration: String(eventType.durationMinutes) })}
          </li>
          {modes.map((mode) => {
            const Icon = MODE_ICONS[mode]
            return (
              <li
                key={mode}
                className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1"
              >
                <Icon aria-hidden className="size-4 text-muted-foreground" />
                {t(`modeChips.${mode}`)}
              </li>
            )
          })}
        </ul>
        <p className="text-sm text-muted-foreground">
          {t("cancellationPolicy", { name: policy.name })}
        </p>
      </div>
      <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end">
        <p className="text-lg font-medium">
          {minPrice === 0
            ? t("free")
            : t("fromPrice", { price: formatEur(minPrice, locale) })}
        </p>
        {eventType.modes.length > 0 ? (
          <Link
            href={`/${username}/${eventType.slug}`}
            className={buttonVariants({ className: "rounded-full" })}
          >
            {t("book")}
          </Link>
        ) : null}
      </div>
    </li>
  )
}

async function UpcomingSlots({
  locale,
  username,
  eventTypes,
  timeZone,
}: {
  locale: string
  username: string
  eventTypes: PublicEventType[]
  timeZone: string
}) {
  const t = await getTranslations("profile")
  // Hour-aligned so the API's calendar busy cache key repeats across renders.
  const from = new Date()
  from.setUTCMinutes(0, 0, 0)
  const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000)
  const api = await createServerPublicApiClient()
  const modeQueries = eventTypes.flatMap((eventType) =>
    eventType.modes.map((mode) => ({
      eventSlug: eventType.slug,
      eventTitle: pickLocalizedText(eventType.title, locale),
      modeId: mode.id,
      mode: mode.mode,
      locationLabel: publicPlaceLabel(mode.location),
    }))
  )

  const modeSlots: UpcomingModeSlots[] = await Promise.all(
    modeQueries.map(async (query) => {
      try {
        const slots = await api.public.getSlots(username, query.eventSlug, {
          modeId: query.modeId,
          from: from.toISOString(),
          to: to.toISOString(),
          tz: timeZone,
        })
        return { ...query, starts: slots.slots.map((slot) => slot.start) }
      } catch {
        return { ...query, starts: [] }
      }
    })
  )

  const upcoming = pickUpcomingSlotRows(modeSlots)

  if (upcoming.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noSlots")}</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {upcoming.map((slot) => {
        const when = formatSlotDateTime(slot.start, locale, timeZone)
        const Icon = MODE_ICONS[slot.mode]
        const place = slot.locationLabel
          ? `${t(`modeChips.${slot.mode}`)} · ${slot.locationLabel}`
          : t(`modeChips.${slot.mode}`)
        return (
          <li key={`${slot.eventSlug}-${slot.modeId}-${slot.start}`}>
            <Link
              href={bookingSelectionHref(username, slot.eventSlug, {
                modeId: slot.modeId,
                start: slot.start,
              })}
              data-testid="profile-upcoming-slot"
              data-event-slug={slot.eventSlug}
              aria-label={t("bookSlot", { offer: slot.eventTitle, when })}
              className="group flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors hover:border-primary hover:bg-teal-50/60 dark:hover:bg-teal-950/40"
            >
              <Icon aria-hidden className="size-5 shrink-0 text-primary" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-foreground">{when}</span>
                <span className="truncate text-muted-foreground">
                  {slot.eventTitle} · {place}
                </span>
              </span>
              <CaretRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
