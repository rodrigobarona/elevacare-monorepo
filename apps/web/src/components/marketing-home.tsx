import { Suspense } from "react"
import { getLocale, getTranslations } from "next-intl/server"
import type { ListPublicExpertsResponse } from "@eleva/api-client"
import { ArrowRightIcon, ShieldCheckIcon } from "@eleva/icons"
import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { ElevaImage } from "@eleva/media/image"
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

/**
 * One frame for every portrait on the page: a sand field, with the person
 * cut out of her photograph's background and set at one face size, so a row
 * of portraits reads as one set. A photograph that has not been cut out
 * fills the same frame.
 */
const PORTRAIT =
  "overflow-hidden rounded-xl bg-coral-100 [&_img]:object-cover [&_img]:object-top"

type Directory = ListPublicExpertsResponse | null

/**
 * The public homepage, built from what women ask (design direction E,
 * `docs/eleva-v3/design-audit/brand-directions.md`). The hero is the film
 * with one question and one action; need-first browsing is a list of
 * questions; experts speak through their own headline. Two colour fields,
 * each used once: deep teal for how experts are checked, coral to close.
 *
 * The page uses a cooler paper than the product (`--background` is set on
 * the wrapper), so the change stays on this page until the direction is
 * signed off for `@eleva/ui`.
 */
export async function MarketingHome() {
  return (
    <div className="flex min-h-dvh flex-col bg-background [--background:var(--color-neutral-50)] [--border:var(--color-neutral-200)] [--muted:var(--color-neutral-100)]">
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
          posedLabel={t("hero.posed")}
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
                <article
                  data-testid="home-expert-card"
                  className="group relative grid h-full grid-cols-[5.5rem_minmax(0,1fr)] content-start gap-x-4 rounded-3xl border bg-card p-3.5 transition-colors focus-within:ring-3 focus-within:ring-ring/50 hover:border-foreground/40 sm:flex sm:flex-col"
                >
                  <div
                    className={cn(PORTRAIT, "aspect-square sm:aspect-[18/19]")}
                  >
                    <ExpertPortrait
                      displayName={expert.displayName}
                      avatarUrl={expert.avatarUrl}
                    />
                  </div>
                  <div className="self-center sm:order-2 sm:mt-5 sm:self-auto sm:px-2.5">
                    <h3 className="text-lg font-medium">
                      <Link
                        href={`/${expert.username}`}
                        className="outline-none after:absolute after:inset-0 after:rounded-3xl"
                      >
                        {expert.displayName}
                      </Link>
                    </h3>
                    {areas.length > 0 ? (
                      <p className="text-base text-muted-foreground">
                        {areas.join(" · ")}
                      </p>
                    ) : null}
                    <p className="mt-1.5 flex items-start gap-1.5 text-base">
                      <ShieldCheckIcon
                        aria-hidden
                        weight="fill"
                        className="mt-1 size-4 shrink-0"
                      />
                      {tExperts("checkedMark")}
                    </p>
                  </div>
                  {expert.headline ? (
                    // In the expert's own words, so it is set as speech.
                    <p className="col-span-2 mt-4 line-clamp-3 font-display text-xl leading-snug tracking-tight text-pretty sm:order-1 sm:mt-5 sm:min-h-[4.2em] sm:px-2.5">
                      {expert.headline}
                    </p>
                  ) : null}
                  <div className="col-span-2 mt-4 flex flex-col sm:order-3 sm:mx-2.5 sm:mt-auto sm:pt-5">
                    {languages.length > 0 || price ? (
                      <dl className="grid grid-cols-2 gap-4 border-t py-3.5 text-base">
                        {languages.length > 0 ? (
                          <div>
                            <dt className="text-muted-foreground">
                              {t("people.speaks")}
                            </dt>
                            <dd className="font-medium">
                              {list.format(languages)}
                            </dd>
                          </div>
                        ) : null}
                        {price ? (
                          <div>
                            <dt className="text-muted-foreground">
                              {t("people.sessions")}
                            </dt>
                            <dd className="font-medium">{price}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                    <p
                      aria-hidden
                      className="flex min-h-12 items-center gap-1.5 border-t pt-1 text-lg font-medium text-primary group-hover:underline group-hover:underline-offset-[5px]"
                    >
                      {t("people.profile")}
                      <ArrowRightIcon className="size-4.5" />
                    </p>
                  </div>
                </article>
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
                    PORTRAIT,
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
    <section className="bg-coral-400 px-4 py-18 text-neutral-950 sm:px-6 sm:py-24">
      <Container className="grid items-end gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-18">
        <div>
          <h2 className={H2}>{t("close.heading")}</h2>
          <p className="mt-3.5 max-w-[24em] text-xl text-pretty">
            {t("close.lead")}
          </p>
          <Link
            href="/experts"
            className={cn(
              buttonVariants({ variant: "inverse", size: "xl" }),
              "mt-7 w-full sm:w-auto"
            )}
          >
            {t("close.cta")}
          </Link>
        </div>
        <div className="border-neutral-950/40 max-lg:border-t max-lg:pt-8 lg:border-l lg:pl-10">
          <h3 className="font-display text-2xl tracking-tight">
            {t("close.pro.heading")}
          </h3>
          <p className="mt-2 text-lg text-pretty">{t("close.pro.lead")}</p>
          <p className="mt-2 flex flex-wrap gap-x-6">
            {(
              [
                ["/become-expert", "cta"],
                ["/for-clinics", "clinics"],
              ] as const
            ).map(([href, key]) => (
              <Link
                key={href}
                href={href}
                className="inline-flex min-h-11 items-center font-medium underline decoration-[1.5px] underline-offset-[5px]"
              >
                {t(`close.pro.${key}`)}
              </Link>
            ))}
          </p>
        </div>
      </Container>
    </section>
  )
}
