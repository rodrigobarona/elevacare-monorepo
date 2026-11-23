import { Suspense } from "react"
import { getLocale, getTranslations } from "next-intl/server"
import type { ListPublicExpertsResponse } from "@eleva/api-client"
import { ArrowRightIcon, ShieldCheckIcon } from "@eleva/icons"
import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { ElevaImage } from "@eleva/media/image"
import { CtaBand, ctaBandLinkClass } from "@eleva/ui/blocks/cta-band"
import { ExpertCard, expertPortraitFrame } from "@eleva/ui/blocks/expert-card"
import { ExpertPortrait } from "@eleva/ui/blocks/expert-portrait"
import { Container } from "@eleva/ui/blocks/section"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { cn } from "@eleva/ui/lib/utils"
import { HomeHero } from "@/components/home/home-hero"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Link } from "@/i18n/navigation"
import { ADVISORS } from "@/lib/advisors"
import { formatEur } from "@/lib/format-eur"
import { HERO_FILM_QUESTIONS, HOME_QUESTIONS } from "@/lib/home-questions"
import {
  isMarketplaceCategory,
  MARKETPLACE_CATEGORY_SLUGS,
} from "@/lib/marketplace-categories"
import { getPublicDirectory } from "@/lib/public-api-server"

const FEATURED_ADVISOR_IDS: readonly string[] = [
  "kariBo",
  "jennyBagwell",
  "cristineHomsiJorge",
]

/** How many experts the homepage introduces. The directory has the rest. */
const HOME_EXPERTS = 3
/** A phone shows this many questions; the area row and the directory follow. */
const PHONE_QUESTIONS = 4

const H2 = "font-display text-3xl tracking-tight text-balance sm:text-4xl"
const LINK =
  "inline-flex min-h-11 items-center gap-1.5 font-medium text-primary underline decoration-[1.5px] underline-offset-[5px]"

type Directory = ListPublicExpertsResponse | null

/**
 * The public homepage, built from what women ask (design direction E,
 * `docs/eleva-v3/design-audit/brand-directions.md`). The hero is the film
 * with one question and one action; need-first browsing is a list of
 * questions; experts speak through their own headline. Two colour fields,
 * each used once: deep teal for how experts are checked, coral to close.
 */
export async function MarketingHome() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <MarketingContent />
      </main>
      <SiteFooter />
    </div>
  )
}

async function MarketingContent() {
  const [t, requestLocale] = await Promise.all([
    getTranslations("home"),
    getLocale(),
  ])
  const locale: Locale = isLocale(requestLocale) ? requestLocale : defaultLocale
  // Not awaited here: the hero must not wait for the directory.
  const directory = getPublicDirectory()

  return (
    <>
      <div className="pt-2 sm:pt-3">
        <HomeHero
          locale={locale}
          heading={t("hero.heading")}
          lead={t("hero.lead")}
          action={t("hero.cta")}
          pauseLabel={t("hero.pause")}
          playLabel={t("hero.play")}
          note={t("hero.note")}
          scenes={HERO_FILM_QUESTIONS.map((scene) => ({
            from: scene.from,
            text: scene.id
              ? t(`questions.items.${scene.id}`)
              : t("hero.heading"),
          }))}
        />
      </div>

      {/* Until the directory answers, every question leads to all experts. */}
      <Suspense fallback={<Questions directory={null} />}>
        <Questions directory={directory} />
      </Suspense>

      <Suspense fallback={null}>
        <People directory={directory} locale={locale} />
      </Suspense>

      <Checked />
      <HowBookingWorks />
      <Advisors locale={locale} />
      <Faq />
      <Close />
    </>
  )
}

/** Areas of care that have at least one listed expert. */
function listedAreas(directory: Directory): ReadonlySet<string> {
  return new Set(
    (directory?.experts ?? []).flatMap((expert) => expert.categorySlugs)
  )
}

async function Questions({
  directory: pending,
}: {
  directory: Promise<Directory> | null
}) {
  const [t, tExperts, directory] = await Promise.all([
    getTranslations("home"),
    getTranslations("experts"),
    pending,
  ])
  const areas = listedAreas(directory)
  const areaChips = MARKETPLACE_CATEGORY_SLUGS.filter((slug) => areas.has(slug))

  return (
    <section id="questions" className="px-4 pt-16 sm:px-6 sm:pt-20">
      <Container>
        <h2 className={H2}>{t("questions.heading")}</h2>
        <ul className="mt-8 grid gap-x-14 sm:grid-cols-2">
          {HOME_QUESTIONS.map((question, index) => (
            <li
              key={question.id}
              className={cn(
                "border-t last:border-b sm:nth-last-[2]:border-b",
                index >= PHONE_QUESTIONS && "max-sm:hidden",
                index === PHONE_QUESTIONS - 1 && "max-sm:border-b"
              )}
            >
              <Link
                // An area with nobody listed would be a dead end.
                href={
                  areas.has(question.category)
                    ? `/experts/${question.category}`
                    : "/experts"
                }
                className="group grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 px-1 py-3.5"
              >
                <span className="font-display text-xl leading-snug tracking-tight text-pretty decoration-[1.5px] underline-offset-[5px] group-hover:underline sm:text-2xl">
                  {t(`questions.items.${question.id}`)}
                </span>
                <span className="col-start-1 text-base text-muted-foreground">
                  {tExperts(`categories.${question.category}`)}
                </span>
                <ArrowRightIcon
                  aria-hidden
                  className="col-start-2 row-span-2 row-start-1 size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"
                />
              </Link>
            </li>
          ))}
        </ul>
        {areaChips.length >= 2 ? (
          <nav
            aria-label={t("questions.areas")}
            className="mt-7 flex flex-col gap-x-5 gap-y-3 sm:flex-row sm:items-center"
          >
            <span className="text-base text-muted-foreground" aria-hidden>
              {t("questions.areas")}
            </span>
            <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
              {areaChips.map((slug) => (
                <li key={slug} className="shrink-0">
                  <Link
                    href={`/experts/${slug}`}
                    className="inline-flex min-h-11 items-center rounded-full border bg-card px-4.5 text-base whitespace-nowrap transition-colors hover:border-primary hover:text-primary"
                  >
                    {tExperts(`categories.${slug}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </Container>
    </section>
  )
}

async function People({
  directory: pending,
  locale,
}: {
  directory: Promise<Directory>
  locale: Locale
}) {
  const [t, tExperts, directory] = await Promise.all([
    getTranslations("home"),
    getTranslations("experts"),
    pending,
  ])
  const people = (directory?.experts ?? []).slice(0, HOME_EXPERTS)
  // No experts to show, or the directory is unreachable: the page goes
  // straight from the questions to how experts are checked.
  if (people.length === 0) return null
  const list = new Intl.ListFormat(locale, { type: "conjunction" })

  return (
    <section id="experts" className="px-4 pt-16 sm:px-6 sm:pt-24">
      <Container>
        <div className="flex flex-col gap-x-8 gap-y-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className={H2}>{t("people.heading")}</h2>
            {/* How the list is ordered sits beside it (TRUST-13, DISC-05). */}
            <p className="mt-2.5 text-base text-pretty text-muted-foreground">
              {tExperts("orderedBy", { sort: tExperts("sort.relevance") })}{" "}
              <Link
                href={`/legal/terms#${tExperts("rankingAnchor")}`}
                className="underline underline-offset-4 hover:text-foreground"
              >
                {tExperts("rankingLink")}
              </Link>
            </p>
          </div>
          <Link href="/experts" className={LINK}>
            {tExperts("seeAll")}
          </Link>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {people.map((expert) => {
            const areas = expert.categorySlugs
              .filter(isMarketplaceCategory)
              .slice(0, 2)
              .map((slug) => tExperts(`categories.${slug}`))
            const languages = expert.languages
              .filter((code) => code === "en" || code === "pt" || code === "es")
              .map((code) => tExperts(`languages.${code}`))
            const price =
              expert.minPriceCents == null
                ? null
                : expert.minPriceCents === 0
                  ? tExperts("freeSession")
                  : tExperts("fromPrice", {
                      price: formatEur(expert.minPriceCents, locale),
                    })
            return (
              <li key={expert.username}>
                <ExpertCard
                  data-testid="home-expert-card"
                  href={`/${expert.username}`}
                  linkAs={Link}
                  media={
                    <ExpertPortrait
                      displayName={expert.displayName}
                      avatarUrl={expert.avatarUrl}
                    />
                  }
                  name={expert.displayName}
                  headline={expert.headline}
                  badge={
                    expert.topExpertActive ? tExperts("topExpert") : undefined
                  }
                  checkedLabel={tExperts("checkedMark")}
                  meta={areas.length > 0 ? areas.join(" · ") : undefined}
                  facts={[
                    ...(languages.length > 0
                      ? [
                          {
                            label: tExperts("card.speaks"),
                            value: list.format(languages),
                          },
                        ]
                      : []),
                    ...(price
                      ? [{ label: tExperts("card.sessions"), value: price }]
                      : []),
                  ]}
                  action={tExperts("card.profile")}
                />
              </li>
            )
          })}
        </ul>
      </Container>
    </section>
  )
}

async function Checked() {
  const t = await getTranslations("home")
  return (
    <section className="mt-20 bg-teal-950 px-4 py-18 text-white sm:mt-28 sm:px-6 sm:py-24">
      <Container className="grid items-start gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
        <div>
          <ShieldCheckIcon
            aria-hidden
            weight="fill"
            className="size-11 text-teal-200"
          />
          <h2 className={cn(H2, "mt-5 max-w-[19em]")}>
            {t("checked.heading")}
          </h2>
        </div>
        <ul className="text-lg text-white/90">
          {(["practice", "price"] as const).map((key) => (
            <li key={key} className="border-t border-white/30 py-5">
              <b className="block font-display text-2xl font-normal tracking-tight text-white">
                {t(`checked.${key}.title`)}
              </b>
              {t(`checked.${key}.body`)}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

/** A piece of the product drawn as a picture: nothing in it can be pressed. */
function Sample({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex min-h-52 flex-col justify-center gap-1.5 rounded-3xl bg-teal-100/70 p-6 text-base text-neutral-800 select-none",
        className
      )}
    >
      {children}
    </div>
  )
}

async function HowBookingWorks() {
  const t = await getTranslations("home")
  const times = ["09:00", "10:30", "11:15", "14:00", "15:30", "17:00"]
  const steps = [
    {
      key: "pick",
      sample: (
        <Sample>
          <span>{t("how.sample.day")}</span>
          <span className="mt-2 grid grid-cols-3 gap-2">
            {times.map((time) => (
              <span
                key={time}
                className={cn(
                  "grid min-h-11 place-content-center rounded-xl text-lg font-medium",
                  time === "10:30"
                    ? "bg-neutral-950 text-white"
                    : "bg-white text-neutral-950"
                )}
              >
                {time}
              </span>
            ))}
          </span>
        </Sample>
      ),
    },
    {
      key: "meet",
      sample: (
        <Sample>
          <span>{t("how.sample.email")}</span>
          <span className="font-display text-2xl tracking-tight text-neutral-950">
            {t("how.sample.when")}
          </span>
          <span>{t("how.sample.session")}</span>
          <span className="mt-3 self-start rounded-full bg-neutral-950 px-5 py-3 leading-none font-medium text-white">
            {t("how.sample.join")}
          </span>
        </Sample>
      ),
    },
    {
      key: "next",
      sample: (
        <Sample>
          <span className="font-display text-2xl tracking-tight text-neutral-950">
            {t("how.sample.followUp")}
          </span>
          <span>{t("how.sample.followUpMeta")}</span>
          <span className="mt-3 self-start rounded-full px-5 py-3 leading-none font-medium text-neutral-950 ring-[1.5px] ring-neutral-950">
            {t("how.sample.again")}
          </span>
        </Sample>
      ),
    },
  ] as const

  return (
    <section id="how" className="px-4 py-18 sm:px-6 sm:py-28">
      <Container>
        <h2 className={H2}>{t("how.heading")}</h2>
        <ol className="mt-9 grid gap-x-5 gap-y-10 lg:grid-cols-[1.3fr_1fr_1fr]">
          {steps.map((step) => (
            <li key={step.key}>
              {step.sample}
              <p className="mt-6 text-base font-medium text-muted-foreground">
                {t(`how.${step.key}.label`)}
              </p>
              <h3 className="mt-1 font-display text-2xl tracking-tight">
                {t(`how.${step.key}.title`)}
              </h3>
              <p className="mt-1.5 max-w-[24em] text-lg text-pretty text-muted-foreground">
                {t(`how.${step.key}.body`)}
              </p>
            </li>
          ))}
        </ol>
        <Link
          href="/experts"
          className={cn(
            buttonVariants({ size: "xl" }),
            "mt-11 w-full sm:w-auto"
          )}
        >
          {t("how.cta")}
        </Link>
      </Container>
    </section>
  )
}

async function Advisors({ locale }: { locale: Locale }) {
  const [t, tAbout] = await Promise.all([
    getTranslations("home"),
    getTranslations("about"),
  ])
  const featured = ADVISORS.flatMap((person) =>
    "cutout" in person && FEATURED_ADVISOR_IDS.includes(person.id)
      ? [person]
      : []
  )
  const others = ADVISORS.length - featured.length

  return (
    <section className="bg-card px-4 py-18 sm:px-6 sm:py-24">
      <Container className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-18">
        <div>
          <h2 className={H2}>{t("advisors.heading")}</h2>
          <p className="mt-4 max-w-[28em] text-lg text-pretty text-muted-foreground">
            {t("advisors.lead")}
          </p>
          <Link href="/about#advisors" className={cn(LINK, "mt-4")}>
            {t("advisors.cta")}
          </Link>
        </div>
        <div>
          <ul className="grid gap-x-7 max-sm:divide-y sm:grid-cols-3">
            {featured.map((person) => (
              <li
                key={person.id}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4 py-3.5 sm:block sm:py-0"
              >
                <span
                  className={cn(
                    expertPortraitFrame,
                    "relative block aspect-[18/19] sm:w-36"
                  )}
                >
                  <ElevaImage
                    slug={person.cutout}
                    locale={locale}
                    decorative
                    fill
                    sizes="(min-width: 640px) 144px, 72px"
                    className="object-cover object-top"
                  />
                </span>
                <span className="block sm:mt-4">
                  <b className="block text-lg leading-snug font-medium">
                    {person.name}
                  </b>
                  <span className="block text-base text-muted-foreground">
                    {tAbout(`advisors.${person.id}.role`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {others > 0 ? (
            <p className="mt-6 text-base text-muted-foreground">
              {t("advisors.more", { count: others })}
            </p>
          ) : null}
        </div>
      </Container>
    </section>
  )
}

async function Faq() {
  const t = await getTranslations("home")
  const items = ["account", "who", "cost", "session", "cancel"] as const
  return (
    <section className="px-4 py-18 sm:px-6 sm:py-28">
      <Container size="narrow">
        <h2 className={H2}>{t("faq.heading")}</h2>
        <div className="mt-7 border-b">
          {items.map((key, index) => (
            <details key={key} open={index === 0} className="group border-t">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-xl tracking-tight sm:text-2xl [&::-webkit-details-marker]:hidden">
                {t(`faq.${key}.q`)}
                <span
                  aria-hidden
                  className="text-2xl leading-none font-light transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[36em] pb-6 text-lg text-pretty text-muted-foreground">
                {t(`faq.${key}.a`)}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  )
}

async function Close() {
  const t = await getTranslations("home")
  return (
    <CtaBand
      title={t("close.heading")}
      lead={t("close.lead")}
      actions={
        <Link
          href="/experts"
          className={cn(
            buttonVariants({ variant: "inverse", size: "xl" }),
            "w-full sm:w-auto"
          )}
        >
          {t("close.cta")}
        </Link>
      }
      aside={
        <>
          <h3 className="font-display text-2xl tracking-tight">
            {t("close.pro.heading")}
          </h3>
          <p className="mt-2 text-lg text-pretty">{t("close.pro.lead")}</p>
          <p className="mt-2 flex flex-wrap gap-x-6">
            <Link href="/become-expert" className={ctaBandLinkClass}>
              {t("close.pro.cta")}
            </Link>
            <Link href="/for-clinics" className={ctaBandLinkClass}>
              {t("close.pro.clinics")}
            </Link>
          </p>
        </>
      }
    />
  )
}
