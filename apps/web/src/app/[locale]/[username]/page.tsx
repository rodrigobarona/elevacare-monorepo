import { Suspense, type ReactNode } from "react"
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
import { EU_SERVICE_COUNTRIES } from "@eleva/config"
import { professionalBodyById } from "@eleva/config/professional-bodies"
import { isReserved } from "@eleva/config/reserved-usernames"
import { RichTextViewer } from "@eleva/editor/rich-text-viewer"
import {
  CheckIcon,
  GlobeIcon,
  MapPinIcon,
  ShieldCheckIcon,
  SOCIAL_LINK_ICONS,
  TranslateIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import {
  ExpertPortrait,
  ExpertPortraitFallback,
} from "@eleva/ui/blocks/expert-portrait"
import { Container, Section } from "@eleva/ui/blocks/section"
import { zoneCity } from "@eleva/ui/lib/booking/slot-groups"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@eleva/ui/components/accordion"
import { InfoPopover } from "@eleva/ui/components/info-popover"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Heading } from "@eleva/ui/components/typography"
import { cn } from "@eleva/ui/lib/utils"
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
import {
  isNotFoundApiError,
  isPracticeClosedApiError,
  isRateLimitedApiError,
} from "@/lib/public-api"
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
    // A closed practice (410) shows as unknown until the "Practice closed"
    // page ships with the expert settings slice (ADR-026, 6b).
    if (isNotFoundApiError(error) || isPracticeClosedApiError(error)) {
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
        {/* Hero: the expert's own front door, led by her portrait (Mindvalley,
            Future Pro, Insight Timer). On phones the portrait runs edge to
            edge with her name on its foot; without a photo the same frame
            holds a branded field and her initials (PROF-03). */}
        <Section spacing="compact" className="pt-0 max-sm:px-0 sm:pt-14">
          <Container className="grid gap-6 sm:gap-10 lg:grid-cols-[minmax(0,500px)_minmax(0,1fr)] lg:items-center lg:gap-16 xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)]">
            {/* Phones: the photo is capped (6:7, at most 64svh) but the
                name and headline sit in flow, so a long headline grows the
                frame instead of being clipped. */}
            <div className="relative flex w-full flex-col justify-end overflow-hidden bg-coral-100 max-sm:min-h-[min(116.667vw,64svh)] sm:mx-auto sm:aspect-[4/5] sm:max-w-md sm:rounded-3xl lg:max-w-none [&_img]:object-top">
              <div className="absolute inset-0">
                {expert.avatarUrl ? (
                  <ExpertPortrait
                    displayName={name}
                    avatarUrl={expert.avatarUrl}
                    isPriority
                  />
                ) : (
                  <ExpertPortraitFallback displayName={name} />
                )}
              </div>
              {/* Phones: who she is, set on the portrait. The h1 below
                  carries the same name for assistive tech. */}
              <div
                aria-hidden
                className={cn(
                  "relative px-4 pt-28 pb-5 text-white sm:hidden",
                  // The teal field needs no scrim; a photo does.
                  expert.avatarUrl &&
                    "bg-linear-to-t from-black/80 via-black/55 to-transparent"
                )}
              >
                <p
                  className={cn(
                    "font-display text-[2.5rem] leading-[1.05] font-medium tracking-tight text-balance",
                    expert.avatarUrl &&
                      "[text-shadow:0_1px_12px_rgb(0_0_0/0.5)]"
                  )}
                >
                  {name}
                </p>
                {expert.headline ? (
                  <p className="mt-1.5 text-lg text-pretty text-white/90">
                    {expert.headline}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-5 max-sm:px-4">
              <div className="flex flex-col gap-3">
                <h1
                  data-testid="expert-profile-heading"
                  className="font-display text-4xl leading-[1.05] font-medium tracking-tight text-balance max-sm:sr-only sm:text-5xl"
                >
                  {name}
                </h1>
                {expert.headline ? (
                  <p className="max-w-2xl text-xl text-pretty text-foreground/80 max-sm:sr-only sm:text-2xl">
                    {expert.headline}
                  </p>
                ) : null}
              </div>
              {/* Proof sits right under who she is (PROF-01). */}
              <RegistrationProof
                registration={expert.registration}
                locale={locale}
                t={t}
              />
              {facts.length > 0 ? (
                <ul
                  className="flex max-w-2xl flex-col gap-2.5 text-[0.9375rem]"
                  data-testid="expert-facts"
                >
                  {facts.map((fact) => {
                    const Icon = FACT_ICONS[fact.kind]
                    return (
                      <li key={fact.kind} className="flex items-start gap-2.5">
                        <Icon
                          aria-hidden
                          className="mt-0.5 size-5 shrink-0 text-primary"
                        />
                        <span className="text-pretty">{fact.text}</span>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
                {categories.length > 0 ? (
                  <ul className="mr-2 flex flex-wrap gap-2">
                    {categories.map((slug) => (
                      <li key={slug}>
                        <Link
                          href={`/experts/${slug}`}
                          className="inline-flex min-h-11 items-center rounded-full border border-teal-200 bg-card px-3.5 text-sm font-medium text-teal-800 transition-colors hover:border-primary hover:bg-teal-50 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none dark:border-teal-800 dark:text-teal-200 dark:hover:bg-teal-950"
                        >
                          {tExperts(`categories.${slug}`)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {expert.socialLinks.length > 0 ? (
                  <ul className="flex flex-wrap gap-1">
                    {expert.socialLinks.map((link) => {
                      const Icon = SOCIAL_LINK_ICONS[link.kind]
                      // A globe alone does not say "website": that one link
                      // shows its word; brand icons speak for themselves.
                      const isWebsite = link.kind === "website"
                      return (
                        <li key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer me"
                            aria-label={t(`social.${link.kind}`, { name })}
                            className={
                              isWebsite
                                ? "flex h-11 items-center gap-2 rounded-full px-3 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                                : "flex size-11 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                            }
                          >
                            <Icon aria-hidden className="size-5" />
                            {isWebsite ? (
                              <span aria-hidden>
                                {t("socialShort.website")}
                              </span>
                            ) : null}
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
                {/* Share is secondary to her own links (PROF-10). */}
                <SharePageButton
                  url={pageUrl}
                  title={t("title", { name })}
                  label={t("share.label")}
                  accessibleLabel={t("share.accessible", { name })}
                  copiedLabel={t("share.copied")}
                  copyFailedLabel={t("share.copyFailed")}
                  iconOnly
                />
              </div>
            </div>
          </Container>
        </Section>

        <Section spacing="compact" className="pb-20">
          {/* One booking card: after the services on phones, a sticky
              side column from lg. */}
          <Container
            className={cn(
              "grid gap-x-16 gap-y-14",
              bookable.length > 0 && "lg:grid-cols-[minmax(0,1fr)_380px]"
            )}
          >
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
                <NotBookableYet
                  name={name}
                  username={expert.username}
                  category={categories[0] ?? null}
                  t={t}
                />
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

              {/* Booking questions only apply when she can be booked. */}
              {bookable.length > 0 ? (
                <section
                  aria-labelledby="with-eleva-heading"
                  className="flex flex-col gap-4"
                >
                  <Heading id="with-eleva-heading" as="h2" size="title">
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
              ) : null}
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

/** Booking questions; joining moved here from the removed "How booking works" (D7.2). */
const WITH_ELEVA_ITEMS = ["account", "join", "cancel", "care"] as const

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
  const meta = serviceMeta(eventType, locale, t)
  // A free session costs nothing to cancel: no policy line.
  const cancellation =
    price.min === 0 && !price.varies
      ? null
      : freeCancellationLine(eventType.cancellationPolicy, t)
  const visibleIncluded = included.slice(0, 3)
  const moreIncluded = included.slice(3)
  const places = inPersonPlaces(eventType)

  return (
    <li
      id={eventType.slug}
      className="flex scroll-mt-24 flex-col gap-4 rounded-3xl border bg-card p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-display text-2xl leading-tight font-medium tracking-tight text-balance">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">{meta}</p>
        </div>
        <p className="shrink-0 pt-0.5 text-lg font-medium tabular-nums">
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
          // cn, not cva's className: the base `border-transparent` must
          // lose to a visible border, like the booking card's time buttons.
          className={cn(
            buttonVariants({ variant: "outline" }),
            "min-h-11 shrink-0 rounded-full border-input-border bg-card hover:border-primary"
          )}
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
    <div className="flex flex-col gap-3 rounded-3xl border bg-card p-6">
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
  const zoneName = zoneCity(timeZone, locale)

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
      policy:
        price.min === 0 && !price.varies
          ? null
          : freeCancellationLine(eventType.cancellationPolicy, t),
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
        timesIn: t("card.timesIn", { city: zoneName }),
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

/**
 * "60 min · Video call": a quiet line under the service title. Where an
 * in-person session takes place is listed on the card, not repeated here.
 */
/** The hero's words for each way to meet, reused in the service line. */
const FACT_WORD = {
  online: "video",
  phone: "phone",
  in_person: "inPerson",
} as const satisfies Record<SessionMode, string>

function serviceMeta(
  eventType: PublicEventType,
  locale: Locale,
  t: ProfileT
): string {
  const modes: SessionMode[] = [
    ...new Set(eventType.modes.map((mode) => mode.mode)),
  ]
  const minutes = eventType.durationMinutes
  if (modes.length === 1) return t(`services.meta.${modes[0]!}`, { minutes })
  // "20 min · Video or phone": every way you can meet, in one line.
  const ways = listFormat(
    modes.map((mode) =>
      t(`facts.${FACT_WORD[mode]}`).toLocaleLowerCase(intlLocales[locale])
    ),
    locale,
    "or"
  )
  return t("services.metaMixed", { minutes, modes: capitalise(ways) })
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
 * The registration Eleva staff checked, as proof under the name (Care.com,
 * Headspace): who checked, when, what (professional body and licence, the
 * health regulator's number written out) and a plain "What we check".
 * The wording ("checked", not "verified") needs legal review.
 */
function RegistrationProof({
  registration,
  locale,
  t,
}: {
  registration: PublicExpertProfile["registration"]
  locale: Locale
  t: ProfileT
}) {
  const body = professionalBodyById(registration?.professionalBody)
  if (!registration || !body) return null
  const month = registration.checkedAt
    ? new Intl.DateTimeFormat(intlLocales[locale], {
        month: "long",
        year: "numeric",
        // "YYYY-MM" parses as UTC midnight on the 1st: keep it in UTC.
        timeZone: "UTC",
      }).format(new Date(registration.checkedAt))
    : null
  // Numbers never break: they are what a member types into the register.
  const number = (chunks: ReactNode) => (
    <span className="whitespace-nowrap">{chunks}</span>
  )
  return (
    // Borderless, so it reads as part of who she is beside a large
    // portrait rather than as a form field.
    <div data-testid="expert-registration" className="max-w-xl">
      {/* The (i) sits beside the heading, not inside it, so the heading
          reads as one sentence; its tap area matches the page's buttons. */}
      <div className="flex items-start gap-1">
        <h2 className="flex items-center gap-2 text-[0.9375rem] font-medium">
          <ShieldCheckIcon
            aria-hidden
            className="size-5 shrink-0 text-primary"
            weight="fill"
          />
          {month
            ? t("registration.checked", { month })
            : t("registration.checkedShort")}
        </h2>
        <InfoPopover
          label={t("registration.whatWeCheckLabel")}
          title={t("registration.whatWeCheck")}
          className="-my-2.5 size-11 sm:-my-1 sm:size-8"
          data-testid="registration-info"
        >
          <p>{t("registration.whatWeCheckBody")}</p>
        </InfoPopover>
      </div>
      <ul className="mt-1.5 space-y-0.5 pl-7 text-sm text-muted-foreground">
        <li>
          <a
            href={body.website}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("registration.bodyLink", { body: body.name })}
            className="rounded-sm text-foreground/80 underline decoration-foreground/40 underline-offset-4 hover:text-foreground hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none"
          >
            {body.name}
          </a>
          {" · "}
          {t.rich("registration.licence", {
            number,
            value: registration.licenceNumber,
          })}
        </li>
        {registration.ersRegistrationNumber ? (
          <li>
            {t.rich("registration.ersFull", {
              number,
              value: registration.ersRegistrationNumber,
            })}
          </li>
        ) : null}
      </ul>
    </div>
  )
}

type ProfileFact = {
  kind: "languages" | "meet" | "countries"
  text: string
}

const FACT_ICONS = {
  languages: TranslateIcon,
  meet: VideoCameraIcon,
  countries: GlobeIcon,
} as const

/** Above this many countries the hero names a few and counts the rest. */
const COUNTRIES_SHOWN = 3

/**
 * The facts a member scans for first, one row each with an icon
 * (PROF-04): languages, how and where you meet, and where members can
 * be. Training has its own section just below, so it is not repeated.
 */
function profileFacts(
  expert: PublicExpertProfile,
  bookable: PublicEventType[],
  locale: Locale,
  t: ProfileT
): ProfileFact[] {
  const facts: ProfileFact[] = []
  const languages = expert.languages.map((code) =>
    displayLanguageLabel(code, locale)
  )
  if (languages.length > 0) {
    facts.push({
      kind: "languages",
      text: t("facts.languages", { languages: listFormat(languages, locale) }),
    })
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
  // "Video or in person in Lisboa, Porto and Madrid": one way to meet
  // per visit, so "or"; only the first word is capitalised.
  if (ways.length > 0) {
    facts.push({
      kind: "meet",
      text: capitalise(listFormat(ways, locale, "or")),
    })
  }
  const served = new Set(expert.serviceCountries)
  const coversEu = EU_SERVICE_COUNTRIES.every((code) => served.has(code))
  const countries = (
    coversEu
      ? expert.serviceCountries.filter(
          (code) => !(EU_SERVICE_COUNTRIES as readonly string[]).includes(code)
        )
      : expert.serviceCountries
  ).map((code) => displayRegion(code, locale))
  if (coversEu) {
    facts.push({
      kind: "countries",
      text:
        countries.length > 0
          ? t("facts.countriesEuAnd", {
              countries: listFormat(countries, locale),
            })
          : t("facts.countriesEu"),
    })
  } else if (countries.length > COUNTRIES_SHOWN + 1) {
    facts.push({
      kind: "countries",
      text: t("facts.countriesMore", {
        countries: countries.slice(0, COUNTRIES_SHOWN).join(", "),
        count: countries.length - COUNTRIES_SHOWN,
      }),
    })
  } else if (countries.length > 0) {
    facts.push({
      kind: "countries",
      text: t("facts.countries", { countries: listFormat(countries, locale) }),
    })
  }
  return facts
}

function listFormat(
  items: string[],
  locale: Locale,
  kind: "and" | "or" = "and"
): string {
  return new Intl.ListFormat(intlLocales[locale], {
    style: "long",
    type: kind === "or" ? "disjunction" : "conjunction",
  }).format(items)
}

function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
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

/**
 * A profile with nothing bookable yet: say so, and offer experts in the
 * same area who can be booked now (Care.com, PROF-08). Never a dead end.
 */
async function NotBookableYet({
  name,
  username,
  category,
  t,
}: {
  name: string
  username: string
  category: string | null
  t: ProfileT
}) {
  const api = await createServerPublicApiClient()
  const others = await api.public
    .listExperts(category ? { category } : {})
    .then((result) =>
      result.experts
        .filter(
          (other) => other.username !== username && other.minPriceCents != null
        )
        .slice(0, 3)
    )
    .catch(() => [])
  return (
    <section
      aria-labelledby="not-bookable-heading"
      className="flex max-w-4xl flex-col gap-5 rounded-3xl bg-muted/50 p-6 sm:p-8"
      data-testid="not-bookable"
    >
      <div className="flex flex-col gap-2">
        <Heading id="not-bookable-heading" as="h2" size="subtitle">
          {t("notBookable.heading", { name })}
        </Heading>
        <p className="text-pretty text-muted-foreground">
          {t(category ? "notBookable.body" : "notBookable.bodyAny")}
        </p>
      </div>
      {others.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">{t("notBookable.others")}</p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {others.map((other) => (
              <li key={other.username}>
                <Link
                  href={`/${other.username}`}
                  className="group flex items-center gap-3 rounded-3xl border bg-card p-3 transition-colors hover:border-foreground/40 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:flex-col sm:items-start"
                >
                  <span className="relative block size-16 shrink-0 overflow-hidden rounded-xl bg-coral-100 sm:aspect-[18/19] sm:h-auto sm:w-full [&_img]:object-top">
                    <ExpertPortrait
                      displayName={other.displayName}
                      avatarUrl={other.avatarUrl}
                    />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium group-hover:text-primary">
                      {other.displayName}
                    </span>
                    {other.headline ? (
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        {other.headline}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        href={category ? `/experts/${category}` : "/experts"}
        className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary underline underline-offset-4"
      >
        {t("notBookable.browse")}
      </Link>
    </section>
  )
}
