import { buttonVariants } from "@eleva/ui/components/button-variants"
import { ArrowRightIcon } from "@eleva/icons"
import { Link } from "@/i18n/navigation"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"

type Props = {
  draftBanner: string
  heading: string
  headingTestId: string
  body: string
  ctaHref: string
  ctaLabel: string
  stepsHeading?: string
  steps?: { title: string; body: string }[]
}

export function MarketingDraftPage({
  draftBanner,
  heading,
  headingTestId,
  body,
  ctaHref,
  ctaLabel,
  stepsHeading,
  steps = [],
}: Props) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 py-16">
        <article className="mx-auto max-w-3xl">
          <p
            data-testid="legal-draft-banner"
            className="mb-4 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-warning"
          >
            {draftBanner}
          </p>
          <h1
            data-testid={headingTestId}
            className="font-heading text-3xl tracking-tight sm:text-4xl"
          >
            {heading}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            {body}
          </p>
          {steps.length > 0 ? (
            <section className="mt-12">
              <h2 className="font-heading text-2xl">{stepsHeading}</h2>
              <ol className="mt-6 grid gap-4 sm:grid-cols-2">
                {steps.map((step, index) => (
                  <li
                    key={step.title}
                    className="rounded-xl border bg-card p-5"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </span>
                    <h3 className="mt-3 font-medium">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          <div className="mt-8">
            <Link href={ctaHref} className={buttonVariants({ size: "lg" })}>
              {ctaLabel}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  )
}
