import { buttonVariants } from "@eleva/ui/components/button-variants"
import { ArrowRightIcon } from "@eleva/icons"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { SiteHeader } from "@/components/site-header"

export function MarketingHome() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        nav={[
          { href: "/experts", labelKey: "experts" },
          { href: "/about", labelKey: "about" },
        ]}
      />
      <MarketingContent />
    </div>
  )
}

function MarketingContent() {
  const t = useTranslations()

  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="mb-4 text-sm font-medium tracking-widest text-primary uppercase">
          {t("home.eyebrow")}
        </p>
        <h1
          data-testid="marketing-hero"
          className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
        >
          {t("home.heading")}
          <span className="text-primary">{t("home.headingAccent")}</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          {t("home.description")}
        </p>
        <div className="mt-10 flex gap-4">
          <Link href="/experts" className={buttonVariants({ size: "lg" })}>
            {t("home.cta")}
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
          <Link
            href="/about"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            {t("home.ctaSecondary")}
          </Link>
        </div>
      </main>

      <footer className="border-t px-6 py-8">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm text-muted-foreground">
            {t("footer.rights", { year: new Date().getFullYear().toString() })}
          </p>
        </div>
      </footer>
    </>
  )
}
