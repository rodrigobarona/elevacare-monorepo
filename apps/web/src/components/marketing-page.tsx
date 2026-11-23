import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import {
  BuildingsIcon,
  CalendarCheckIcon,
  ChartBarIcon,
  EnvelopeIcon,
  WalletIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
  UsersIcon,
  VideoCameraIcon,
  type Icon,
} from "@eleva/icons"
import { ElevaImage } from "@eleva/media/image"
import { CtaBand } from "@eleva/ui/blocks/cta-band"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { Steps } from "@eleva/ui/blocks/steps"
import { TrustStrip } from "@eleva/ui/blocks/trust-strip"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Heading, Lead } from "@eleva/ui/components/typography"
import { getLocale } from "next-intl/server"
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

/** A way to reach the team: a mailbox with what it is for. */
export type ContactChannel = {
  icon: MarketingIconId
  title: string
  body: string
  email: string
}

type Props = {
  heading: string
  headingTestId: string
  body: string
  imageSlug?: string
  /**
   * Gateway-absolute, unprefixed path into another zone (account
   * sign-up / workspace creation). Rendered as a plain `<a>`: the
   * next-intl Link would add `/pt` or `/es` and land on a 404.
   */
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
  contactsHeading?: string
  contacts?: ContactChannel[]
}

/** Public landing pages for professionals and clinics, and the contact page. */
export async function MarketingPage({
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
  contactsHeading,
  contacts = [],
}: Props) {
  const requestLocale = await getLocale()
  const locale: Locale = isLocale(requestLocale) ? requestLocale : defaultLocale

  const benefitItems = benefits.map((item) => {
    const IconComponent = MARKETING_ICONS[item.icon]
    return {
      icon: <IconComponent aria-hidden />,
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
                <a href={cta.href} className={buttonVariants({ size: "xl" })}>
                  {cta.label}
                </a>
              ) : null}
            </div>
            {imageSlug ? (
              <div className="relative aspect-4/5 overflow-hidden rounded-3xl">
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

        {contacts.length > 0 ? (
          <Section spacing="compact" className="pb-20 sm:pb-28">
            <Container className="flex flex-col gap-10">
              {contactsHeading ? (
                <SectionHeader title={contactsHeading} />
              ) : null}
              <ul
                data-testid="contact-channels"
                className="grid gap-x-14 sm:grid-cols-2"
              >
                {contacts.map((channel) => {
                  const IconComponent = MARKETING_ICONS[channel.icon]
                  return (
                    <li
                      key={channel.email}
                      className="flex flex-col gap-2 border-t py-6"
                    >
                      <IconComponent aria-hidden className="size-7" />
                      <p className="font-display text-2xl tracking-tight text-foreground">
                        {channel.title}
                      </p>
                      <p className="text-lg text-pretty text-muted-foreground">
                        {channel.body}
                      </p>
                      <a
                        href={`mailto:${channel.email}`}
                        className="mt-1 inline-flex min-h-11 w-fit items-center font-medium text-primary underline decoration-[1.5px] underline-offset-[5px]"
                      >
                        {channel.email}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </Container>
          </Section>
        ) : null}

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
              <ul className="grid gap-x-14 sm:grid-cols-2">
                {requirements.map((item) => (
                  <li
                    key={item.title}
                    className="flex flex-col gap-1.5 border-t py-5"
                  >
                    <p className="font-display text-2xl tracking-tight text-foreground">
                      {item.title}
                    </p>
                    <p className="text-lg text-pretty text-muted-foreground">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </Container>
          </Section>
        ) : null}

        {finalHeading && finalBody ? (
          <CtaBand
            title={finalHeading}
            lead={finalBody}
            actions={
              finalCta ? (
                <a
                  href={finalCta.href}
                  className={buttonVariants({ variant: "inverse", size: "xl" })}
                >
                  {finalCta.label}
                </a>
              ) : null
            }
          />
        ) : null}
      </main>
      <SiteFooter />
    </div>
  )
}
