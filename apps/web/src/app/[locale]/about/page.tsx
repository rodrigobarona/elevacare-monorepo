import {
  defaultLocale,
  isLocale,
  localeNames,
  locales,
  type Locale,
} from "@eleva/config/i18n"
import {
  ArrowRightIcon,
  BookOpenIcon,
  HandHeartIcon,
  HeartbeatIcon,
  MapPinIcon,
  PhoneIcon,
  UsersIcon,
  VideoCameraIcon,
} from "@eleva/icons"
import { ElevaImage } from "@eleva/media/image"
import { CtaBand, ctaBandLinkClass } from "@eleva/ui/blocks/cta-band"
import { expertPortraitFrame } from "@eleva/ui/blocks/expert-card"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { TrustStrip } from "@eleva/ui/blocks/trust-strip"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Heading } from "@eleva/ui/components/typography"
import { cn } from "@eleva/ui/lib/utils"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { ADVISORS } from "@/lib/advisors"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { CARE_AREAS } from "@/lib/care-areas"
import type { Metadata } from "next"
import type * as React from "react"

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

const MEETING_MODES = [
  { key: "online", icon: VideoCameraIcon },
  { key: "phone", icon: PhoneIcon },
  { key: "inPerson", icon: MapPinIcon },
] as const

type Fact = {
  key: string
  label: string
  icon?: React.ReactNode
  href?: string
  lang?: string
}

const factChipClass =
  "inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-sm text-teal-900 ring-1 ring-teal-100 dark:bg-teal-950 dark:text-teal-100 dark:ring-teal-900 [&_svg]:size-4 [&_svg]:text-teal-700 dark:[&_svg]:text-teal-300"

function FactCard({ title, facts }: { title: string; facts: Fact[] }) {
  return (
    <li className="flex flex-col gap-6 rounded-3xl bg-background p-7 shadow-1 ring-1 ring-border/60 sm:p-8">
      <p className="flex items-end gap-3">
        <span className="font-heading text-7xl leading-[0.85] text-primary tabular-nums">
          {facts.length}
        </span>
        <span className="text-lg font-medium text-balance text-foreground">
          {title}
        </span>
      </p>
      <ul className="flex flex-wrap gap-2">
        {facts.map((fact) => (
          <li key={fact.key}>
            {fact.href ? (
              <Link
                href={fact.href}
                className={`${factChipClass} transition-colors hover:bg-teal-100 dark:hover:bg-teal-900`}
              >
                {fact.label}
              </Link>
            ) : (
              <span lang={fact.lang} className={factChipClass}>
                {fact.icon}
                {fact.label}
              </span>
            )}
          </li>
        ))}
      </ul>
    </li>
  )
}

const LEADERSHIP = [
  {
    id: "patriciaMota",
    name: "Patrícia Mota, PT, PhD",
    slug: "team-patricia-mota-cutout",
  },
  {
    id: "rodrigoBarona",
    name: "Rodrigo Barona",
    slug: "team-rodrigo-barona-cutout",
  },
] as const

export default async function AboutPage({ params }: Props) {
  const { locale: requestLocale } = await params
  setRequestLocale(requestLocale)
  const locale: Locale = isLocale(requestLocale) ? requestLocale : defaultLocale
  const [t, tHome] = await Promise.all([
    getTranslations("about"),
    getTranslations("home"),
  ])

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Section>
          <Container className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            <SectionHeader as="h1" title={t("heading")} lead={t("intro")} />
            <div className="relative aspect-4/3 overflow-hidden rounded-3xl">
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
          <Container className="flex flex-col gap-8">
            <h2 className="font-display text-2xl tracking-tight">
              {t("stats.heading")}
            </h2>
            <ul className="grid gap-4 md:grid-cols-3">
              <FactCard
                title={t("stats.modes.title")}
                facts={MEETING_MODES.map(({ key, icon: Icon }) => ({
                  key,
                  label: t(`stats.modes.items.${key}`),
                  icon: <Icon weight="duotone" />,
                }))}
              />
              <FactCard
                title={t("stats.languages.title")}
                facts={locales.map((code) => ({
                  key: code,
                  label: localeNames[code],
                  lang: code,
                }))}
              />
              <FactCard
                title={t("stats.specialities.title")}
                facts={CARE_AREAS.map((area) => ({
                  key: area.key,
                  label: tHome(`services.${area.key}.title`),
                  href: area.href,
                }))}
              />
            </ul>
          </Container>
        </Section>

        <Section>
          <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="relative order-last aspect-4/3 overflow-hidden rounded-3xl lg:order-first">
              <ElevaImage
                slug="support-conversation"
                locale={locale}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-6">
              <SectionHeader title={t("mission.heading")} />
              <div className="flex max-w-xl flex-col gap-4 text-lg text-pretty text-muted-foreground">
                <p>{t("mission.p1")}</p>
                <p>{t("mission.p2")}</p>
              </div>
            </div>
          </Container>
        </Section>

        <Section tone="primary">
          <Container>
            <SectionHeader
              align="center"
              inverse
              title={t("vision.heading")}
              lead={t("vision.lead")}
            />
          </Container>
        </Section>

        <Section>
          <Container className="flex flex-col gap-12">
            <SectionHeader title={t("beliefs.heading")} />
            <TrustStrip
              items={[
                {
                  icon: <HeartbeatIcon weight="duotone" />,
                  title: t("beliefs.access.title"),
                  description: t("beliefs.access.description"),
                },
                {
                  icon: <BookOpenIcon weight="duotone" />,
                  title: t("beliefs.knowledge.title"),
                  description: t("beliefs.knowledge.description"),
                },
                {
                  icon: <UsersIcon weight="duotone" />,
                  title: t("beliefs.collaborative.title"),
                  description: t("beliefs.collaborative.description"),
                },
                {
                  icon: <HandHeartIcon weight="duotone" />,
                  title: t("beliefs.lifelong.title"),
                  description: t("beliefs.lifelong.description"),
                },
              ]}
            />
          </Container>
        </Section>

        <Section tone="muted" id="team">
          <Container className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div className="flex flex-col items-start gap-6">
              <SectionHeader title={t("team.heading")} />
              <div className="flex max-w-xl flex-col gap-4 text-pretty text-muted-foreground">
                <p>{t("team.p1")}</p>
                <p>{t("team.p2")}</p>
              </div>
              <Link
                href="/history"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                {t("team.storyCta")}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </div>
            <div className="flex flex-col gap-6">
              <Heading as="h3" size="title">
                {t("team.leadershipHeading")}
              </Heading>
              <ul className="grid gap-6 sm:grid-cols-2">
                {LEADERSHIP.map((person) => (
                  <li key={person.id} className="flex flex-col gap-4">
                    <div
                      className={cn(
                        expertPortraitFrame,
                        "relative aspect-[18/19]"
                      )}
                    >
                      <ElevaImage
                        slug={person.slug}
                        locale={locale}
                        fill
                        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {person.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t(`team.roles.${person.id}`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </Section>

        <Section id="advisors">
          <Container className="flex flex-col gap-12">
            <SectionHeader
              title={t("advisors.heading")}
              lead={t("advisors.lead")}
            />
            <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {ADVISORS.map((person) => (
                <li key={person.id} className="flex flex-col gap-4">
                  <div
                    className={cn(
                      expertPortraitFrame,
                      "relative aspect-[18/19]"
                    )}
                  >
                    <ElevaImage
                      slug={person.cutout}
                      locale={locale}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="font-medium text-foreground">{person.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(`advisors.${person.id}.role`)}
                    </p>
                  </div>
                  <blockquote className="border-l-2 border-foreground/20 pl-4 font-display text-lg leading-snug text-pretty text-foreground">
                    {t(`advisors.${person.id}.quote`)}
                  </blockquote>
                </li>
              ))}
            </ul>
          </Container>
        </Section>

        <CtaBand
          title={t("join.heading")}
          lead={t("join.lead")}
          actions={
            <>
              <Link
                href="/become-expert"
                className={buttonVariants({ variant: "inverse", size: "xl" })}
              >
                {t("join.cta")}
              </Link>
              <Link href="/experts" className={ctaBandLinkClass}>
                {t("join.secondary")}
              </Link>
            </>
          }
        />
      </main>
      <SiteFooter />
    </div>
  )
}
