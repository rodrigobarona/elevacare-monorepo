import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import {
  ArrowRightIcon,
  BookOpenIcon,
  HandHeartIcon,
  HeartbeatIcon,
  UsersIcon,
} from "@eleva/icons"
import { ElevaImage } from "@eleva/media/image"
import { CtaBand } from "@eleva/ui/blocks/cta-band"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { TrustStrip } from "@eleva/ui/blocks/trust-strip"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Accent, Heading } from "@eleva/ui/components/typography"
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

const LEADERSHIP = [
  {
    id: "patriciaMota",
    name: "Patrícia Mota, PT, PhD",
    slug: "team-patricia-mota",
  },
  { id: "rodrigoBarona", name: "Rodrigo Barona", slug: "team-rodrigo-barona" },
] as const

const ADVISORS = [
  { id: "kariBo", name: "Kari Bø, PT, PhD", slug: "team-kari-bo" },
  {
    id: "rubenBarakat",
    name: "Ruben Barakat, PhD",
    slug: "team-ruben-barakat",
  },
  {
    id: "alexandreDelgado",
    name: "Alexandre Delgado, PT, PhD",
    slug: "team-alexandre-delgado",
  },
  {
    id: "cristineHomsiJorge",
    name: "Cristine Homsi Jorge, PT, PhD",
    slug: "team-cristine-homsi-jorge",
  },
  {
    id: "annelieGutke",
    name: "Annelie Gutke, PT, PhD",
    slug: "team-annelie-gutke",
  },
  {
    id: "joanaBarros",
    name: "Joana Goulão Barros, MD, PhD",
    slug: "team-joana-barros",
  },
  {
    id: "patriciaDriusso",
    name: "Patricia Driusso, PT, PhD",
    slug: "team-patricia-driusso",
  },
  {
    id: "jennyBagwell",
    name: "Jenny Bagwell, PT, PhD, DPT",
    slug: "team-jenny-bagwell",
  },
] as const

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
          <Container className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="relative order-last aspect-4/3 overflow-hidden rounded-4xl lg:order-first">
              <ElevaImage
                slug="support-conversation"
                locale={locale}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-6">
              <SectionHeader
                eyebrow={t("mission.eyebrow")}
                title={t("mission.heading")}
              />
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
              eyebrow={t("vision.eyebrow")}
              title={
                <>
                  {t("vision.heading")}
                  <Accent>{t("vision.headingAccent")}</Accent>
                </>
              }
              lead={t("vision.lead")}
            />
          </Container>
        </Section>

        <Section>
          <Container className="flex flex-col gap-12">
            <SectionHeader
              eyebrow={t("beliefs.eyebrow")}
              title={t("beliefs.heading")}
            />
            <TrustStrip
              items={[
                {
                  icon: <HeartbeatIcon />,
                  title: t("beliefs.access.title"),
                  description: t("beliefs.access.description"),
                },
                {
                  icon: <BookOpenIcon />,
                  title: t("beliefs.knowledge.title"),
                  description: t("beliefs.knowledge.description"),
                },
                {
                  icon: <UsersIcon />,
                  title: t("beliefs.collaborative.title"),
                  description: t("beliefs.collaborative.description"),
                },
                {
                  icon: <HandHeartIcon />,
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
              <SectionHeader
                eyebrow={t("team.eyebrow")}
                title={t("team.heading")}
              />
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
                    <div className="relative aspect-square overflow-hidden rounded-3xl bg-muted">
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
              eyebrow={t("advisors.eyebrow")}
              title={t("advisors.heading")}
              lead={t("advisors.lead")}
            />
            <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {ADVISORS.map((person) => (
                <li key={person.id} className="flex flex-col gap-4">
                  <div className="relative aspect-square overflow-hidden rounded-3xl bg-muted">
                    <ElevaImage
                      slug={person.slug}
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
                  <blockquote className="border-l-2 border-primary/30 pl-4 font-heading text-base text-pretty text-foreground italic">
                    {t(`advisors.${person.id}.quote`)}
                  </blockquote>
                </li>
              ))}
            </ul>
          </Container>
        </Section>

        <Section spacing="compact" className="pb-24">
          <Container>
            <CtaBand
              eyebrow={t("join.eyebrow")}
              title={t("join.heading")}
              lead={t("join.lead")}
              media={
                <ElevaImage
                  slug="expert-at-desk"
                  locale={locale}
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover"
                />
              }
              actions={
                <>
                  <Link
                    href="/become-expert"
                    className={buttonVariants({
                      variant: "inverse",
                      size: "lg",
                    })}
                  >
                    {t("join.cta")}
                    <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                  <Link
                    href="/experts"
                    className={buttonVariants({
                      variant: "ghost",
                      size: "lg",
                      className:
                        "text-white hover:bg-white/10 hover:text-white",
                    })}
                  >
                    {t("join.secondary")}
                  </Link>
                </>
              }
            />
          </Container>
        </Section>
      </main>
      <SiteFooter />
    </div>
  )
}
