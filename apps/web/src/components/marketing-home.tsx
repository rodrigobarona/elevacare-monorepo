import { getLocale, getTranslations } from "next-intl/server"
import {
  ArrowRightIcon,
  SealCheckIcon,
  TagIcon,
  TranslateIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { ElevaImage } from "@eleva/media/image"
import { ElevaVideo } from "@eleva/media/video"
import { CtaBand } from "@eleva/ui/blocks/cta-band"
import { MediaCard } from "@eleva/ui/blocks/media-card"
import { MediaHero, MediaHeroActions } from "@eleva/ui/blocks/media-hero"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { Steps } from "@eleva/ui/blocks/steps"
import { TrustStrip } from "@eleva/ui/blocks/trust-strip"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Accent, Eyebrow, Heading, Lead } from "@eleva/ui/components/typography"
import { Link } from "@/i18n/navigation"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { ADVISORS } from "@/lib/advisors"
import { CARE_AREAS } from "@/lib/care-areas"
import { MARKETPLACE_CATEGORY_SLUGS } from "@/lib/marketplace-categories"

const FEATURED_ADVISOR_IDS: readonly string[] = [
  "kariBo",
  "jennyBagwell",
  "cristineHomsiJorge",
]

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
  const [t, tAbout, tExperts, requestLocale] = await Promise.all([
    getTranslations("home"),
    getTranslations("about"),
    getTranslations("experts"),
    getLocale(),
  ])
  const locale: Locale = isLocale(requestLocale) ? requestLocale : defaultLocale
  const featuredAdvisors = ADVISORS.filter((person) =>
    FEATURED_ADVISOR_IDS.includes(person.id)
  )
  const otherAdvisors = ADVISORS.filter(
    (person) => !FEATURED_ADVISOR_IDS.includes(person.id)
  )

  return (
    <>
      <MediaHero
        media={<ElevaVideo slug="hero-intro" locale={locale} priority />}
        aside={
          <>
            <MediaCard
              variant="overlay"
              aspect="fill"
              linkAs={Link}
              href="/experts/wellness"
              media={
                <ElevaImage
                  slug="menopause-portrait"
                  locale={locale}
                  fill
                  sizes="30vw"
                />
              }
              title={t("hero.aside.stages")}
            />
            <MediaCard
              variant="overlay"
              aspect="fill"
              linkAs={Link}
              href="/experts"
              media={
                <ElevaImage
                  slug="support-conversation"
                  locale={locale}
                  fill
                  sizes="30vw"
                />
              }
              title={t("hero.aside.listen")}
            />
          </>
        }
      >
        <div className="flex max-w-4xl flex-col gap-6">
          <Eyebrow tone="inverse">{t("hero.eyebrow")}</Eyebrow>
          <Heading
            as="h1"
            size="display"
            tone="inverse"
            data-testid="marketing-hero"
            className="font-light text-balance"
          >
            {t("hero.heading")}
            <Accent>{t("hero.headingAccent")}</Accent>
          </Heading>
          <Lead className="max-w-xl text-white/85">
            {t("hero.description")}
          </Lead>
        </div>
        <MediaHeroActions>
          <Link
            href="/experts"
            className={buttonVariants({ variant: "inverse", size: "xl" })}
          >
            {t("hero.cta")}
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
          <Link
            href="/become-expert"
            className={buttonVariants({
              variant: "ghost",
              size: "xl",
              className: "text-white hover:bg-white/10 hover:text-white",
            })}
          >
            {t("hero.ctaSecondary")}
          </Link>
        </MediaHeroActions>
        <p className="max-w-md text-sm text-white/75">{t("hero.disclaimer")}</p>
      </MediaHero>

      <Section spacing="none" className="py-6 sm:py-8">
        <Container>
          <TrustStrip
            variant="bar"
            items={[
              {
                icon: <SealCheckIcon weight="duotone" />,
                title: t("trust.independent.title"),
              },
              {
                icon: <VideoCameraIcon weight="duotone" />,
                title: t("trust.modes.title"),
              },
              {
                icon: <TranslateIcon weight="duotone" />,
                title: t("trust.languages.title"),
              },
              {
                icon: <TagIcon weight="duotone" />,
                title: t("trust.pricing.title"),
              },
            ]}
          />
        </Container>
      </Section>

      <Section spacing="compact">
        <Container className="flex flex-col gap-10">
          <SectionHeader
            eyebrow={tAbout("advisors.heading")}
            title={
              <>
                {t("advisors.heading")}
                <Accent>{t("advisors.headingAccent")}</Accent>
              </>
            }
            lead={t("advisors.lead")}
          />
          <div className="grid gap-x-6 gap-y-8 sm:grid-cols-3">
            {featuredAdvisors.map((person) => (
              <MediaCard
                key={person.id}
                variant="overlay"
                aspect="square"
                linkAs={Link}
                href="/about#advisors"
                media={
                  <ElevaImage
                    slug={person.slug}
                    locale={locale}
                    fill
                    sizes="(min-width: 640px) 33vw, 100vw"
                  />
                }
                title={person.name}
                description={tAbout(`advisors.${person.id}.role`)}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
            <div aria-hidden className="flex -space-x-3">
              {otherAdvisors.map((person) => (
                <span
                  key={person.id}
                  className="relative size-12 overflow-hidden rounded-full bg-muted ring-2 ring-background"
                >
                  <ElevaImage
                    slug={person.slug}
                    locale={locale}
                    decorative
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </span>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("advisors.more", { count: otherAdvisors.length })}
            </p>
            <Link
              href="/about#advisors"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "bg-card shadow-1",
              })}
            >
              {t("advisors.cta")}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="flex flex-col gap-12">
          <SectionHeader
            eyebrow={t("services.eyebrow")}
            title={
              <>
                {t("services.heading")}
                <Accent>{t("services.headingAccent")}</Accent>
              </>
            }
            lead={t("services.lead")}
          />
          <nav
            aria-label={t("services.browseLabel")}
            className="flex flex-wrap gap-2"
          >
            {MARKETPLACE_CATEGORY_SLUGS.map((slug) => (
              <Link
                key={slug}
                href={`/experts/${slug}`}
                className={buttonVariants({
                  variant: "outline",
                  className: "bg-card shadow-1",
                })}
              >
                {tExperts(`categories.${slug}`)}
              </Link>
            ))}
          </nav>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {CARE_AREAS.map((service) => (
              <MediaCard
                key={service.key}
                linkAs={Link}
                href={service.href}
                media={
                  <ElevaImage
                    slug={service.slug}
                    locale={locale}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  />
                }
                title={t(`services.${service.key}.title`)}
                description={t(`services.${service.key}.description`)}
                actionLabel={t("services.action")}
              />
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="muted">
        <Container className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="flex flex-col gap-12">
            <SectionHeader
              eyebrow={t("how.eyebrow")}
              title={t("how.heading")}
              lead={t("how.lead")}
            />
            <Steps
              className="sm:grid-cols-1 sm:gap-8"
              items={[
                {
                  title: t("how.find.title"),
                  description: t("how.find.description"),
                },
                {
                  title: t("how.book.title"),
                  description: t("how.book.description"),
                },
                {
                  title: t("how.meet.title"),
                  description: t("how.meet.description"),
                },
              ]}
            />
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-4xl shadow-2">
            <ElevaImage
              slug="online-session-home"
              locale={locale}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative order-last aspect-[4/3] overflow-hidden rounded-4xl lg:order-first">
            <ElevaImage
              slug="community-women"
              locale={locale}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col items-start gap-8">
            <SectionHeader
              eyebrow={t("belief.eyebrow")}
              title={
                <>
                  {t("belief.heading")}
                  <Accent>{t("belief.headingAccent")}</Accent>
                </>
              }
              lead={t("belief.lead")}
            />
            <Link
              href="/about"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              {t("belief.cta")}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>
        </Container>
      </Section>

      <Section spacing="compact" className="pb-20 sm:pb-28">
        <Container size="wide">
          <CtaBand
            eyebrow={t("experts.eyebrow")}
            title={
              <>
                {t("experts.heading")}
                <Accent>{t("experts.headingAccent")}</Accent>
              </>
            }
            lead={t("experts.lead")}
            media={
              <ElevaImage
                slug="expert-at-desk"
                locale={locale}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            }
            actions={
              <>
                <Link
                  href="/become-expert"
                  className={buttonVariants({ variant: "accent", size: "xl" })}
                >
                  {t("experts.cta")}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
                <Link
                  href="/for-clinics"
                  className={buttonVariants({
                    variant: "ghost",
                    size: "xl",
                    className: "text-white hover:bg-white/10 hover:text-white",
                  })}
                >
                  {t("experts.ctaSecondary")}
                </Link>
              </>
            }
          />
        </Container>
      </Section>
    </>
  )
}
