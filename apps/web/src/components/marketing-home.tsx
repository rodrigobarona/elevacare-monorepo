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

const SERVICES = [
  {
    key: "pregnancy",
    slug: "service-pregnancy",
    href: "/experts/midwifery",
  },
  {
    key: "pelvicHealth",
    slug: "service-pelvic-health",
    href: "/experts/pelvic-health",
  },
  {
    key: "everyStage",
    slug: "service-every-stage",
    href: "/experts/wellness",
  },
  {
    key: "cancerJourney",
    slug: "service-cancer-journey",
    href: "/experts/physiotherapy",
  },
] as const

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

  return (
    <>
      <MediaHero
        media={<ElevaVideo slug="hero-intro" locale={locale} priority />}
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

      <Section spacing="compact">
        <Container>
          <TrustStrip
            items={[
              {
                icon: <SealCheckIcon />,
                title: t("trust.independent.title"),
                description: t("trust.independent.description"),
              },
              {
                icon: <VideoCameraIcon />,
                title: t("trust.modes.title"),
                description: t("trust.modes.description"),
              },
              {
                icon: <TranslateIcon />,
                title: t("trust.languages.title"),
                description: t("trust.languages.description"),
              },
              {
                icon: <TagIcon />,
                title: t("trust.pricing.title"),
                description: t("trust.pricing.description"),
              },
            ]}
          />
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
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((service) => (
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
