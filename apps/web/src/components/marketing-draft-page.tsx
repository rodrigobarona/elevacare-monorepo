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
}

export function MarketingDraftPage({
  draftBanner,
  heading,
  headingTestId,
  body,
  ctaHref,
  ctaLabel,
}: Props) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        nav={[
          { href: "/", labelKey: "home" },
          { href: "/experts", labelKey: "experts" },
          { href: "/become-expert", labelKey: "becomeExpert" },
          { href: "/for-clinics", labelKey: "forClinics" },
        ]}
      />
      <main className="flex-1 px-6 py-16">
        <article className="mx-auto max-w-3xl">
          <p
            data-testid="legal-draft-banner"
            className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50"
          >
            {draftBanner}
          </p>
          <h1
            data-testid={headingTestId}
            className="text-3xl font-bold tracking-tight sm:text-4xl"
          >
            {heading}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            {body}
          </p>
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
