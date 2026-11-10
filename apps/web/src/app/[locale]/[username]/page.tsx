import { Suspense } from "react"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import type {
  LocalizedList,
  PublicEventType,
  PublicExpertProfile,
} from "@eleva/api-client"
import { intlLocales, type Locale } from "@eleva/config/i18n"
import {
  CANCELLATION_POLICY_TIERS,
  type CancellationPolicy,
} from "@eleva/config/cancellation-policy"
import { resolveGatewayUrl } from "@eleva/config/env"
import { professionalBodyById } from "@eleva/config/professional-bodies"
import { isReserved } from "@eleva/config/reserved-usernames"
import { RichTextViewer } from "@eleva/editor/rich-text-viewer"
import { CheckIcon, MapPinIcon, SOCIAL_LINK_ICONS } from "@eleva/icons"
import {
  ExpertMonogram,
  ExpertPortrait,
} from "@eleva/ui/blocks/expert-portrait"
import { Container, Section } from "@eleva/ui/blocks/section"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@eleva/ui/components/accordion"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Heading } from "@eleva/ui/components/typography"
import {
  displayLanguageLabel,
  displayRegion,
} from "@eleva/ui/lib/booking/display-names"
import {
  BookingCard,
  type BookingCardService,
} from "@/components/profile/booking-card"
import { BioReveal } from "@/components/profile/bio-reveal"
import { MobileBookBar } from "@/components/profile/mobile-book-bar"
import { SharePageButton } from "@/components/profile/share-page-button"
import { PublicRateLimited } from "@/components/public-rate-limited"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Link } from "@/i18n/navigation"
import { readBookingGeo } from "@/lib/booking-geo"
import { bookingSelectionHref } from "@/lib/booking-selection"
import { formatEur } from "@/lib/format-eur"
import { hreflangLanguages, localePath } from "@/lib/hreflang"
import { isSupportedLocale, pickLocalizedText } from "@/lib/localized-text"
import { isMarketplaceCategory } from "@/lib/marketplace-categories"
import { isNotFoundApiError, isRateLimitedApiError } from "@/lib/public-api"
import {
  createServerPublicApiClient,
  getPublicExpert,
} from "@/lib/public-api-server"
import {
  pickServiceSlots,
  type SessionMode,
  type UpcomingModeSlots,
} from "@/lib/upcoming-slots"

type ProfileT = Awaited<ReturnType<typeof getTranslations<"profile">>>

/** Bios longer than this start clipped with "Read more" (decided here). */
const BIO_REVEAL_MIN_CHARS = 700
const DAY_MS = 24 * 60 * 60 * 1000

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
    const description =
      expert.headline ?? t("description", { name: expert.displayName })
    return {
      title: t("title", { name: expert.displayName }),
      description,
      alternates: {
        canonical: localePath(locale, path),
        languages: hreflangLanguages(path),
      },
      openGraph: {
        type: "profile",
        title: expert.displayName,
        description,
        ...(expert.avatarUrl ? { images: [{ url: expert.avatarUrl }] } : {}),
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

  let expert: PublicExpertProfile
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
  const name = expert.displayName
  const bookable = expert.eventTypes.filter(
    (eventType) => eventType.modes.length > 0
  )
  const categories = expert.categorySlugs.filter(isMarketplaceCategory)
  const facts = profileFacts(expert, bookable, locale, t)
  const credential = heroCredential(expert)
  const bio = pickBio(expert, locale)
  const minPrice = lowestPrice(bookable)
  const allFree = bookable.every((eventType) => {
    const price = servicePrice(eventType)
    return price.min === 0 && !price.varies
  })
  const pageUrl = new URL(
    localePath(locale, `/${expert.username}`),
    resolveGatewayUrl()
  ).toString()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <script
        type="application/ld+json"
        // eleva: JSON-LD from API fields, serialised (no HTML injection).
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(personJsonLd(expert, pageUrl)).replace(
            /</g,
            "\\u003c"
          ),
        }}
      />
      <main className="flex-1 pb-28 lg:pb-0">
        {/* Hero: the expert's own front door. */}
        <Section
          spacing="compact"
          className="bg-linear-to-b from-sand-50 to-background pt-10 sm:pt-14 dark:from-teal-950/40"
        >
          <Container
            className={
              expert.avatarUrl
                ? "grid items-center gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16"
                : "grid gap-6 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start sm:gap-8"
            }
          >
            {/* A photo is the hero's largest element; without one, a small
                monogram sits beside the name instead of an empty frame. */}
            {expert.avatarUrl ? (
              <div className="relative mx-auto aspect-[4/5] max-h-[50svh] w-full max-w-sm overflow-hidden rounded-4xl bg-muted shadow-2 lg:max-h-none lg:max-w-none">
                <ExpertPortrait
                  displayName={name}
                  avatarUrl={expert.avatarUrl}
                  isPriority
                />
              </div>
            ) : (
              <ExpertMonogram displayName={name} />
            )}
            <div className="flex flex-col gap-5">
              {categories.length > 0 ? (
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {categories.map((slug) => (
                    <li key={slug}>
                      <Link
                        href={`/experts/${slug}`}
                        className="inline-flex min-h-11 items-center eyebrow text-primary underline-offset-4 hover:underline"
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
                  className="font-display text-4xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl"
                >
                  {name}
                </h1>
                {expert.headline ? (
                  <p className="max-w-2xl text-xl text-pretty text-foreground/80 sm:text-2xl">
                    {expert.headline}
                  </p>
                ) : null}
                {credential ? (
                  <p className="text-base text-muted-foreground">
                    {credential}
                  </p>
                ) : null}
              </div>
              {facts.length > 0 ? (
                <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
                  {facts.join(" · ")}
                </p>
              ) : null}
              <RegistrationLine
                registration={expert.registration}
                licenceLabel={(number) => t("registration.licence", { number })}
                ersLabel={(number) => t("registration.ers", { number })}
                bodyLinkLabel={(body) => t("registration.bodyLink", { body })}
              />
              <div className="flex flex-wrap items-center gap-3">
                {expert.socialLinks.length > 0 ? (
                  <ul className="flex flex-wrap gap-1">
                    {expert.socialLinks.map((link) => {
                      const Icon = SOCIAL_LINK_ICONS[link.kind]
                      return (
                        <li key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer me"
                            aria-label={t(`social.${link.kind}`, { name })}
                            className="flex size-11 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            <Icon aria-hidden className="size-5" />
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
                <SharePageButton
                  url={pageUrl}
                  title={t("title", { name })}
                  label={t("share.label")}
                  accessibleLabel={t("share.accessible", { name })}
                  copiedLabel={t("share.copied")}
                  copyFailedLabel={t("share.copyFailed")}
                />
              </div>
            </div>
          </Container>
        </Section>

        <Section spacing="compact" className="pb-20">
          {/* One booking card: after the services on phones, a sticky
              side column from lg. */}
          <Container className="grid gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex min-w-0 flex-col gap-14 lg:col-start-1 lg:row-start-1">
              {bookable.length > 0 ? (
                <section
                  id="services"
                  aria-labelledby="services-heading"
                  className="flex scroll-mt-24 flex-col gap-5"
                >
                  <Heading id="services-heading" as="h2" size="title">
                    {t("services.heading")}
                  </Heading>
                  <ul className="flex flex-col gap-4">
                    {bookable.map((eventType) => (
                      <ServiceCard
                        key={eventType.slug}
                        eventType={eventType}
                        expertName={name}
                        username={expert.username}
                        locale={locale}
                        t={t}
                      />
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="rounded-3xl bg-muted/60 px-6 py-5 text-base text-pretty">
                  {t("notBooking", { name })}
                </p>
              )}
            </div>

            {bookable.length > 0 ? (
              <aside
                id="book"
                className="scroll-mt-24 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
              >
                <Suspense fallback={<BookingCardSkeleton />}>
                  <ProfileBookingCard
                    locale={locale}
                    username={expert.username}
                    eventTypes={bookable}
                    timeZone={geo.timeZone}
                    t={t}
                  />
                </Suspense>
              </aside>
            ) : null}

            <div className="flex min-w-0 flex-col gap-14 lg:col-start-1 lg:row-start-2">
              {bio ? (
                <section
                  aria-labelledby="about-heading"
                  className="flex flex-col gap-4"
                >
                  <Heading id="about-heading" as="h2" size="title">
                    {t("about")}
                  </Heading>
                  {bio.length >= BIO_REVEAL_MIN_CHARS ? (
                    <BioReveal
                      moreLabel={t("readMore")}
                      lessLabel={t("readLess")}
                    >
                      <BioBody expert={expert} locale={locale} />
                    </BioReveal>
                  ) : (
                    <BioBody expert={expert} locale={locale} />
                  )}
                </section>
              ) : null}

              {expert.credentials.length > 0 ? (
                <section
                  aria-labelledby="credentials-heading"
                  className="flex flex-col gap-5"
                >
                  <Heading id="credentials-heading" as="h2" size="title">
                    {t("credentials")}
                  </Heading>
                  <ol className="flex flex-col border-l border-border">
                    {expert.credentials.map((item, index) => (
                      <li
                        key={`${item.title}-${index}`}
                        className="relative flex flex-col gap-0.5 py-3 pl-6 before:absolute before:top-[1.15rem] before:-left-[5px] before:size-2.5 before:rounded-full before:border-2 before:border-primary before:bg-background"
                      >
                        {item.year ? (
                          <span className="text-sm text-muted-foreground tabular-nums">
                            {item.year}
                          </span>
                        ) : null}
                        <span className="font-medium">{item.title}</span>
                        {item.institution ? (
                          <span className="text-sm text-muted-foreground">
                            {item.institution}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              <section
                aria-labelledby="with-eleva-heading"
                className="flex flex-col gap-4"
              >
                <Heading id="with-eleva-heading" as="h2" size="subtitle">
                  {t("withEleva.heading")}
                </Heading>
                <Accordion allowsMultipleExpanded className="bg-card">
                  {WITH_ELEVA_ITEMS.map((item) => (
                    <AccordionItem key={item} id={item}>
                      <AccordionTrigger className="min-h-11 text-base">
                        {t(`withEleva.${item}.q`, { name })}
                      </AccordionTrigger>
                      <AccordionContent className="text-base text-pretty text-muted-foreground">
                        {t(`withEleva.${item}.a`, { name })}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>
            </div>
          </Container>
        </Section>
      </main>
      {bookable.length > 0 ? (
        <MobileBookBar
          priceLabel={
            minPrice == null
              ? null
              : minPrice === 0
                ? allFree
                  ? t("free")
                  : t("freeOption")
                : t("fromPrice", { price: formatEur(minPrice, locale) })
          }
          actionLabel={t("seeTimes")}
          targetId="book"
        />
      ) : null}
      <SiteFooter />
    </div>
  )
}

const WITH_ELEVA_ITEMS = [
  "howItWorks",
  "account",
  "join",
  "cancel",
  "care",
  "checks",
] as const

function BioBody({
  expert,
  locale,
}: {
  expert: PublicExpertProfile
  locale: Locale
}) {
  const rich = pickRichBio(expert, locale)
  if (rich) {
    return (
      <RichTextViewer
        html={rich.html}
        className="text-lg leading-relaxed text-pretty text-foreground/85 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h3]:mt-5 [&_h3]:font-medium [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-4 [&_p:first-child]:mt-0 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5"
      />
    )
  }
  return (
    <p className="text-lg leading-relaxed text-pretty whitespace-pre-line text-foreground/85">
      {expert.bio}
    </p>
  )
}

function ServiceCard({
  eventType,
  expertName,
  username,
  locale,
  t,
}: {
  eventType: PublicEventType
  expertName: string
  username: string
  locale: Locale
  t: ProfileT
}) {
  const title = pickLocalizedText(eventType.title, locale)
  const description = eventType.description
    ? pickLocalizedText(eventType.description, locale)
    : null
  const price = servicePrice(eventType)
  const included = pickList(eventType.whatsIncluded, locale)
  const expect = pickList(eventType.whatToExpect, locale)
  const questions = pickList(eventType.exampleQuestions, locale)
  const eyebrow = formatEyebrow(eventType, locale, t)
  const cancellation = freeCancellationLine(eventType.cancellationPolicy, t)
  const visibleIncluded = included.slice(0, 3)
  const moreIncluded = included.slice(3)
  const places = inPersonPlaces(eventType)

  return (
    <li
      id={eventType.slug}
      className="flex scroll-mt-24 flex-col gap-4 rounded-4xl border bg-card p-6 shadow-1 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="eyebrow text-primary">{eyebrow}</p>
          <h3 className="font-display text-2xl leading-tight font-medium tracking-tight text-balance">
            {title}
          </h3>
        </div>
        <p className="shrink-0 pt-5 text-lg font-medium tabular-nums">
          {price.min === 0
            ? price.varies
              ? t("freeOption")
              : t("free")
            : price.varies
              ? t("fromPrice", { price: formatEur(price.min, locale) })
              : formatEur(price.min, locale)}
        </p>
      </div>
      {description ? (
        <p className="text-pretty text-muted-foreground">{description}</p>
      ) : null}
      {places.length > 0 ? (
        <ul
          aria-label={t("services.where")}
          data-testid="service-places"
          className="flex flex-col gap-1.5 text-sm"
        >
          {places.map((place) => (
            <li key={place.id} className="flex gap-2.5">
              <MapPinIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-primary"
              />
              <span>
                <span className="font-medium">{place.name}</span>
                {place.line ? (
                  <span className="text-muted-foreground"> · {place.line}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {visibleIncluded.length > 0 ? (
        <ul
          aria-label={t("services.included")}
          className="flex flex-col gap-2 text-sm"
        >
          {visibleIncluded.map((item) => (
            <li key={item} className="flex gap-2.5">
              <CheckIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-primary"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {moreIncluded.length > 0 || expect.length > 0 || questions.length > 0 ? (
        <Accordion allowsMultipleExpanded className="rounded-2xl">
          {moreIncluded.length > 0 ? (
            <ServiceDetail
              id="included"
              label={t("services.seeAllIncluded", { count: included.length })}
              items={moreIncluded}
            />
          ) : null}
          {expect.length > 0 ? (
            <ServiceDetail
              id="expect"
              label={t("services.whatToExpect")}
              items={expect}
            />
          ) : null}
          {questions.length > 0 ? (
            <ServiceDetail
              id="questions"
              label={t("services.questions")}
              items={questions}
            />
          ) : null}
        </Accordion>
      ) : null}
      <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {cancellation ? <p>{cancellation}</p> : null}
          {eventType.requiresApproval ? (
            <p>{t("services.requestNote", { name: expertName })}</p>
          ) : null}
        </div>
        <Link
          href={`/${username}/${eventType.slug}`}
          className={buttonVariants({
            className: "min-h-11 shrink-0 rounded-full",
          })}
        >
          {t("seeTimes")}
        </Link>
      </div>
    </li>
  )
}

function ServiceDetail({
  id,
  label,
  items,
}: {
  id: string
  label: string
  items: string[]
}) {
  return (
    <AccordionItem id={id}>
      <AccordionTrigger className="min-h-11">{label}</AccordionTrigger>
      <AccordionContent>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  )
}

function BookingCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-4xl border bg-card p-6">
      <div className="h-7 w-40 animate-pulse rounded-full bg-muted" />
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-11 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}

async function ProfileBookingCard({
  locale,
  username,
  eventTypes,
  timeZone,
  t,
}: {
  locale: Locale
  username: string
  eventTypes: PublicEventType[]
  timeZone: string
  t: ProfileT
}) {
  // Hour-aligned so the API's calendar busy cache key repeats across renders.
  const from = new Date()
  from.setUTCMinutes(0, 0, 0)
  const to = new Date(from.getTime() + 14 * DAY_MS)
  const api = await createServerPublicApiClient()
  const modeSlots: (UpcomingModeSlots & { failed: boolean })[] =
    await Promise.all(
      eventTypes.flatMap((eventType) =>
        eventType.modes.map(async (mode) => {
          const query = {
            eventSlug: eventType.slug,
            modeId: mode.id,
            mode: mode.mode,
            locationLabel: publicPlaceLabel(mode.location),
          }
          try {
            const slots = await api.public.getSlots(username, eventType.slug, {
              modeId: mode.id,
              from: from.toISOString(),
              to: to.toISOString(),
              tz: timeZone,
            })
            return {
              ...query,
              starts: slots.slots.map((slot) => slot.start),
              failed: false,
            }
          } catch {
            return { ...query, starts: [], failed: true }
          }
        })
      )
    )

  // A service is incomplete when any way to meet failed to load. The card
  // still lists the times that did load; with none, it says loading failed
  // instead of claiming the calendar is full.
  const serviceFailed = new Map<string, boolean>()
  for (const mode of modeSlots) {
    serviceFailed.set(
      mode.eventSlug,
      (serviceFailed.get(mode.eventSlug) ?? false) || mode.failed
    )
  }

  const intlLocale = intlLocales[locale]
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const dayLabel = new Intl.DateTimeFormat(intlLocale, {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  })
  const longDay = new Intl.DateTimeFormat(intlLocale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const timeLabel = new Intl.DateTimeFormat(intlLocale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  })
  const zoneName =
    new Intl.DateTimeFormat(intlLocale, {
      timeZone,
      timeZoneName: "longGeneric",
    })
      .formatToParts(from)
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone

  const services: BookingCardService[] = eventTypes.map((eventType) => {
    const title = pickLocalizedText(eventType.title, locale)
    const price = servicePrice(eventType)
    const slots = pickServiceSlots(modeSlots, eventType.slug)
    // Two places can offer the same time: name the place on each time so
    // the buttons are told apart by sight, not only by screen readers.
    const places = eventType.modes.flatMap((mode) =>
      mode.mode === "in_person" && mode.location
        ? [[mode.id, mode.location.name] as const]
        : []
    )
    const placeByMode = places.length > 1 ? new Map(places) : null
    const days = new Map<string, BookingCardService["days"][number]>()
    for (const slot of slots) {
      const date = new Date(slot.start)
      const key = dayKey.format(date)
      const time = timeLabel.format(date)
      const mode = t(`modeChips.${slot.mode}`)
      const day = days.get(key) ?? {
        key,
        label: dayLabel.format(date),
        slots: [],
      }
      day.slots.push({
        href: bookingSelectionHref(username, eventType.slug, {
          modeId: slot.modeId,
          start: slot.start,
        }),
        time,
        mode: slot.mode,
        place: placeByMode?.get(slot.modeId) ?? null,
        start: slot.start,
        ariaLabel: t("bookSlot", {
          offer: title,
          when: `${longDay.format(date)}, ${time}`,
          mode: slot.locationLabel ? `${mode}, ${slot.locationLabel}` : mode,
        }),
      })
      days.set(key, day)
    }
    return {
      slug: eventType.slug,
      title,
      meta:
        price.min === 0 && !price.varies
          ? t("card.metaFree", { minutes: eventType.durationMinutes })
          : price.min === 0
            ? t("card.metaFreeOption", { minutes: eventType.durationMinutes })
            : t(price.varies ? "card.metaFrom" : "card.meta", {
                minutes: eventType.durationMinutes,
                price: formatEur(price.min, locale),
              }),
      policy: freeCancellationLine(eventType.cancellationPolicy, t),
      loadFailed: serviceFailed.get(eventType.slug) === true,
      seeAllHref: `/${username}/${eventType.slug}`,
      days: [...days.values()],
      showModes: new Set(eventType.modes.map((mode) => mode.mode)).size > 1,
    }
  })

  return (
    <BookingCard
      services={services}
      labels={{
        heading: t("card.heading"),
        chooseService: t("card.chooseService"),
        timesIn: t("card.timesIn", { zone: zoneName }),
        full: t("card.full"),
        loadFailed: t("card.loadFailed"),
        laterDates: t("card.laterDates"),
        seeAll: t("card.seeAll"),
        noAccount: t("card.noAccount"),
      }}
    />
  )
}

/**
 * Where each in-person session takes place: the practice name and its
 * street address (ERS Regulation 1058/2016 asks health advertising to say
 * where care is given). One line per place.
 */
function inPersonPlaces(
  eventType: PublicEventType
): { id: string; name: string; line: string }[] {
  const seen = new Map<string, { id: string; name: string; line: string }>()
  for (const mode of eventType.modes) {
    const location = mode.mode === "in_person" ? mode.location : null
    if (!location || seen.has(location.id)) continue
    const street = [location.address, location.line2]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ")
    const town = [location.postalCode?.trim(), location.city]
      .filter(Boolean)
      .join(" ")
    seen.set(location.id, {
      id: location.id,
      name: location.name,
      line: [street, town].filter(Boolean).join(", "),
    })
  }
  return [...seen.values()]
}

function publicPlaceLabel(
  location: { name: string; city: string } | null
): string | null {
  if (!location) return null
  if (location.name === location.city) return location.city
  return `${location.name}, ${location.city}`
}

function servicePrice(eventType: PublicEventType): {
  min: number
  varies: boolean
} {
  const prices = eventType.modes.map((mode) => mode.priceCents)
  if (prices.length === 0) return { min: eventType.priceAmount, varies: false }
  const min = Math.min(...prices)
  return { min, varies: prices.some((price) => price !== min) }
}

function lowestPrice(eventTypes: PublicEventType[]): number | null {
  const prices = eventTypes.map((eventType) => servicePrice(eventType).min)
  return prices.length > 0 ? Math.min(...prices) : null
}

function formatEyebrow(
  eventType: PublicEventType,
  locale: Locale,
  t: ProfileT
): string {
  const modes: SessionMode[] = [
    ...new Set(eventType.modes.map((mode) => mode.mode)),
  ]
  const minutes = eventType.durationMinutes
  if (modes.length !== 1) {
    return t("services.eyebrowMixed", { minutes })
  }
  const mode = modes[0]!
  const place =
    mode === "in_person"
      ? [
          ...new Set(
            eventType.modes
              .map((item) => item.location?.city)
              .filter((city): city is string => Boolean(city))
          ),
        ].join(", ")
      : ""
  const base = t(`services.eyebrow.${mode}`, { minutes })
  return place ? `${base} · ${place}` : base
}

function freeCancellationLine(
  policy: CancellationPolicy,
  t: ProfileT
): string | null {
  const first = CANCELLATION_POLICY_TIERS[policy][0]
  if (!first || first.refundPercent !== 100 || first.minHoursBefore <= 0) {
    return null
  }
  const hours = first.minHoursBefore
  return hours >= 72 && hours % 24 === 0
    ? t("freeCancelDays", { days: hours / 24 })
    : t("freeCancelHours", { hours })
}

/** The reader's language, then English, then any language that has items. */
function pickList(list: LocalizedList, locale: Locale): string[] {
  for (const key of [locale, "en", "pt", "es"] as const) {
    const items = list[key]
    if (items && items.length > 0) return items
  }
  return []
}

function pickRichBio(
  expert: PublicExpertProfile,
  locale: Locale
): { html: string; text: string } | null {
  const rich = expert.bioRich
  if (!rich) return null
  return rich[locale] ?? rich.en ?? rich.pt ?? rich.es ?? null
}

function pickBio(expert: PublicExpertProfile, locale: Locale): string | null {
  const text = pickRichBio(expert, locale)?.text ?? expert.bio
  return text && text.trim().length > 0 ? text : null
}

/**
 * The registration Eleva staff checked: professional body (linked to its
 * public register), licence number and ERS number. Plain facts, no badge
 * (expert-profile-booking-ux-spec: "only real proof").
 */
function RegistrationLine({
  registration,
  licenceLabel,
  ersLabel,
  bodyLinkLabel,
}: {
  registration: PublicExpertProfile["registration"]
  licenceLabel: (number: string) => string
  ersLabel: (number: string) => string
  bodyLinkLabel: (body: string) => string
}) {
  const body = professionalBodyById(registration?.professionalBody)
  if (!registration || !body) return null
  return (
    <p
      data-testid="expert-registration"
      className="max-w-2xl text-sm text-pretty text-muted-foreground"
    >
      <a
        href={body.website}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={bodyLinkLabel(body.name)}
        className="underline decoration-border underline-offset-4 hover:text-foreground hover:decoration-foreground"
      >
        {body.name}
      </a>
      {" · "}
      {licenceLabel(registration.licenceNumber)}
      {registration.ersRegistrationNumber ? (
        <>
          {" · "}
          {ersLabel(registration.ersRegistrationNumber)}
        </>
      ) : null}
    </p>
  )
}

/** First credential, unless the headline already says it. */
function heroCredential(expert: PublicExpertProfile): string | null {
  const first = expert.credentials[0]
  if (!first) return null
  if (expert.headline?.toLowerCase().includes(first.title.toLowerCase())) {
    return null
  }
  return first.institution
    ? `${first.title}, ${first.institution}`
    : first.title
}

function profileFacts(
  expert: PublicExpertProfile,
  bookable: PublicEventType[],
  locale: Locale,
  t: ProfileT
): string[] {
  const facts: string[] = []
  const languages = expert.languages.map((code) =>
    displayLanguageLabel(code, locale)
  )
  if (languages.length > 0) {
    facts.push(
      t("facts.languages", { languages: listFormat(languages, locale) })
    )
  }
  const modes = new Set(
    bookable.flatMap((eventType) => eventType.modes.map((mode) => mode.mode))
  )
  const cities = [
    ...new Set(
      bookable.flatMap((eventType) =>
        eventType.modes
          .map((mode) => mode.location?.city)
          .filter((city): city is string => Boolean(city))
      )
    ),
  ]
  const ways: string[] = []
  if (modes.has("online")) ways.push(t("facts.video"))
  if (modes.has("phone")) ways.push(t("facts.phone"))
  if (modes.has("in_person")) {
    ways.push(
      cities.length > 0
        ? t("facts.inPersonIn", { places: listFormat(cities, locale) })
        : t("facts.inPerson")
    )
  }
  if (ways.length > 0) facts.push(listFormat(ways, locale))
  const countries = expert.serviceCountries.map((code) =>
    displayRegion(code, locale)
  )
  if (countries.length > 0) {
    facts.push(
      t("facts.countries", { countries: listFormat(countries, locale) })
    )
  }
  return facts
}

function listFormat(items: string[], locale: Locale): string {
  return new Intl.ListFormat(intlLocales[locale], {
    style: "long",
    type: "conjunction",
  }).format(items)
}

function personJsonLd(expert: PublicExpertProfile, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: expert.displayName,
    url,
    ...(expert.headline ? { jobTitle: expert.headline } : {}),
    ...(expert.avatarUrl ? { image: expert.avatarUrl } : {}),
    knowsLanguage: expert.languages,
    ...(expert.socialLinks.length > 0
      ? { sameAs: expert.socialLinks.map((link) => link.url) }
      : {}),
  }
}
