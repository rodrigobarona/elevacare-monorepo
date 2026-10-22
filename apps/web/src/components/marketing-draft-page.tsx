import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import {
  ArrowRightIcon,
  BuildingsIcon,
  CalendarCheckIcon,
  ChartBarIcon,
  EnvelopeIcon,
  WalletIcon,
  InfoIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  UsersIcon,
  VideoCameraIcon,
  type Icon,
} from "@eleva/icons"
import { ElevaImage } from "@eleva/media/image"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { Steps } from "@eleva/ui/blocks/steps"
import { TrustStrip } from "@eleva/ui/blocks/trust-strip"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Eyebrow, Heading, Lead } from "@eleva/ui/components/typography"
import { getLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

export type MarketingIconId =
  | "shield"
  | "calendar"
  | "video"
  | "users"
  | "chart"
  | "currency"
  | "buildings"
  | "headset"
  | "stethoscope"

const MARKETING_ICONS: Record<MarketingIconId, Icon> = {
  shield: ShieldCheckIcon,
  calendar: CalendarCheckIcon,
  video: VideoCameraIcon,
  users: UsersIcon,
  chart: ChartBarIcon,
  currency: WalletIcon,
  buildings: BuildingsIcon,
  headset: EnvelopeIcon,
  stethoscope: StethoscopeIcon,
}

type CardItem = { icon: MarketingIconId; title: string; body: string }

type Props = {
  draftBanner: string
  eyebrow: string
  heading: string
  headingTestId: string
  body: string
  imageSlug?: string
  cta?: { href: string; label: string }
  stepsHeading?: string
  steps?: { title: string; body: string }[]
  benefitsHeading?: string
  benefits?: CardItem[]
  requirementsHeading?: string
  requirements?: { title: string; body: string }[]
  finalHeading?: string
  finalBody?: string
  finalCta?: { href: string; label: string }
}

/** Public pages whose terms are still pre-launch drafts (become expert, clinics, contact). */
export async function MarketingDraftPage({
  draftBanner,
  eyebrow,
  heading,
  headingTestId,
  body,
  imageSlug,
  cta,
  stepsHeading,
  steps = [],
  benefitsHeading,
  benefits = [],
  requirementsHeading,
  requirements = [],
  finalHeading,
  finalBody,
  finalCta,
}: Props) {
  const requestLocale = await getLocale()
  const locale: Locale = isLocale(requestLocale) ? requestLocale : defaultLocale

  const benefitItems = benefits.map((item) => {
    const IconComponent = MARKETING_ICONS[item.icon]
    return {
      icon: <IconComponent weight="duotone" aria-hidden />,
      title: item.title,
      description: item.body,
    }
  })

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Section>
          <Container
            className={
              imageSlug
                ? "grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16"
                : "max-w-3xl"
            }
          >
            <div className="flex flex-col items-start gap-6">
              <Eyebrow>{eyebrow}</Eyebrow>
              <Heading
                as="h1"
                size="display"
                data-testid={headingTestId}
                className="text-balance"
              >
                {heading}
              </Heading>
              <Lead>{body}</Lead>
              {cta ? (
                <Link
                  href={cta.href}
                  className={buttonVariants({ size: "xl" })}
                >
                  {cta.label}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              ) : null}
              <p
                data-testid="legal-draft-banner"
                className="flex max-w-xl gap-2 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning"
              >
                <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                {draftBanner}
              </p>
            </div>
            {imageSlug ? (
              <div className="relative aspect-4/5 overflow-hidden rounded-4xl shadow-2">
                <ElevaImage
                  slug={imageSlug}
                  locale={locale}
                  fill
                  priority
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
              </div>
            ) : null}
          </Container>
        </Section>

        {benefits.length > 0 ? (
          <Section tone="muted">
            <Container className="flex flex-col gap-12">
              <SectionHeader title={benefitsHeading} />
              <TrustStrip className="lg:grid-cols-3" items={benefitItems} />
            </Container>
          </Section>
        ) : null}

        {steps.length > 0 ? (
          <Section tone={benefits.length > 0 ? "default" : "muted"}>
            <Container className="flex flex-col gap-12">
              <SectionHeader title={stepsHeading} />
              <Steps
                className="sm:grid-cols-2 lg:grid-cols-4"
                items={steps.map((step) => ({
                  title: step.title,
                  description: step.body,
                }))}
              />
            </Container>
          </Section>
        ) : null}

        {requirements.length > 0 ? (
          <Section tone="muted">
            <Container className="flex max-w-4xl flex-col gap-10">
              <SectionHeader title={requirementsHeading} />
              <ul className="grid gap-8 sm:grid-cols-2">
                {requirements.map((item) => (
                  <li key={item.title} className="flex flex-col gap-2">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-pretty text-muted-foreground">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </Container>
          </Section>
        ) : null}

        {finalHeading && finalBody ? (
          <Section>
            <Container className="flex max-w-3xl flex-col items-start gap-6">
              <SectionHeader title={finalHeading} lead={finalBody} />
              {finalCta ? (
                <Link
                  href={finalCta.href}
                  className={buttonVariants({ size: "xl" })}
                >
                  {finalCta.label}
                  <ArrowRightIcon data-icon="inline-end" />
                </Link>
              ) : null}
            </Container>
          </Section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  )
}
