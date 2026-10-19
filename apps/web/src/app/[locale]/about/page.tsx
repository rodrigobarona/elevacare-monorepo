import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import {
  ArrowRightIcon,
  HandHeartIcon,
  HeartbeatIcon,
  MapPinIcon,
  UsersIcon,
} from "@eleva/icons"
import { ElevaImage } from "@eleva/media/image"
import { CtaBand } from "@eleva/ui/blocks/cta-band"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { TrustStrip } from "@eleva/ui/blocks/trust-strip"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Accent } from "@eleva/ui/components/typography"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import type { Metadata } from "next"

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "about" })
  return {
    title: t("title"),
    description: t("description"),
  }
}

const STATS = ["modes", "languages", "specialities"] as const

export default async function AboutPage({ params }: Props) {
  const { locale: requestLocale } = await params
  setRequestLocale(requestLocale)
  const locale: Locale = isLocale(requestLocale) ? requestLocale : defaultLocale
  const t = await getTranslations("about")

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Section>
          <Container className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <SectionHeader
              as="h1"
              eyebrow={t("eyebrow")}
              title={
                <>
                  {t("heading")}
                  <Accent>{t("headingAccent")}</Accent>
                </>
              }
              lead={t("intro")}
            />
            <div className="relative aspect-4/3 overflow-hidden rounded-4xl shadow-2">
              <ElevaImage
                slug="community-women"
                locale={locale}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          </Container>
        </Section>

        <Section tone="muted" spacing="compact">
          <Container>
            <dl className="grid gap-8 sm:grid-cols-3">
              {STATS.map((key) => (
                <div key={key} className="flex flex-col gap-1">
                  <dt className="text-sm text-muted-foreground">
                    {t(`stats.${key}.label`)}
                  </dt>
                  <dd className="order-first font-heading text-headline text-primary">
                    {t(`stats.${key}.value`)}
                  </dd>
                </div>
              ))}
            </dl>
          </Container>
        </Section>

        <Section>
          <Container className="flex flex-col gap-12">
            <SectionHeader
              eyebrow={t("valuesEyebrow")}
              title={t("valuesHeading")}
            />
            <TrustStrip
              items={[
                {
                  icon: <HeartbeatIcon />,
                  title: t("values.evidenceBased.title"),
                  description: t("values.evidenceBased.description"),
                },
                {
                  icon: <MapPinIcon />,
                  title: t("values.accessible.title"),
                  description: t("values.accessible.description"),
                },
                {
                  icon: <HandHeartIcon />,
                  title: t("values.humanCentred.title"),
                  description: t("values.humanCentred.description"),
                },
                {
                  icon: <UsersIcon />,
                  title: t("values.inclusive.title"),
                  description: t("values.inclusive.description"),
                },
              ]}
            />
          </Container>
        </Section>

        <Section spacing="compact" className="pb-24">
          <Container>
            <CtaBand
              title={t("ctaHeading")}
              lead={t("ctaDescription")}
              media={
                <ElevaImage
                  slug="support-conversation"
                  locale={locale}
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              }
              actions={
                <Link
                  href="/experts"
                  className={buttonVariants({ variant: "inverse", size: "lg" })}
                >
                  {t("cta")}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              }
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </div>
  )
}
