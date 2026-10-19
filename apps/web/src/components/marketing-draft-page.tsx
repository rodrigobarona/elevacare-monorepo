import { defaultLocale, isLocale, type Locale } from "@eleva/config/i18n"
import { ArrowRightIcon, InfoIcon } from "@eleva/icons"
import { ElevaImage } from "@eleva/media/image"
import { Container, Section, SectionHeader } from "@eleva/ui/blocks/section"
import { Steps } from "@eleva/ui/blocks/steps"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { Eyebrow, Heading, Lead } from "@eleva/ui/components/typography"
import { getLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

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
}: Props) {
  const requestLocale = await getLocale()
  const locale: Locale = isLocale(requestLocale) ? requestLocale : defaultLocale

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

        {steps.length > 0 ? (
          <Section tone="muted">
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
      </main>
      <SiteFooter />
    </div>
  )
}
