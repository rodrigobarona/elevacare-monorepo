import { getTranslations, setRequestLocale } from "next-intl/server"
import { ArrowRight, ShieldCheck, Languages, Clock } from "lucide-react"

import { listCategories } from "@eleva/db"
import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Link } from "@/i18n/navigation"

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const categories = await safeListCategories()

  return (
    <>
      <Hero
        eyebrow={t("home.hero.eyebrow")}
        title={t("home.hero.title")}
        subtitle={t("home.hero.subtitle")}
        ctaPrimary={t("home.hero.ctaPrimary")}
        ctaSecondary={t("home.hero.ctaSecondary")}
        trustEN={t("home.hero.trustEN")}
        trustOnline={t("home.hero.trustOnline")}
      />

      <ValueProps />

      <CategoriesPreview
        title={t("home.categories.title")}
        subtitle={t("home.categories.subtitle")}
        viewAllLabel={t("home.categories.viewAll")}
        categories={categories.slice(0, 6).map((c) => ({
          slug: c.slug,
          icon: c.icon,
          name: c.displayName[locale] ?? c.displayName.en,
          description: c.description?.[locale] ?? c.description?.en ?? null,
        }))}
      />

      <PartnerCta
        title={t("home.becomePartner.title")}
        body={t("home.becomePartner.body")}
        cta={t("home.becomePartner.cta")}
      />
    </>
  )
}

function Hero({
  eyebrow,
  title,
  subtitle,
  ctaPrimary,
  ctaSecondary,
  trustEN,
  trustOnline,
}: {
  eyebrow: string
  title: string
  subtitle: string
  ctaPrimary: string
  ctaSecondary: string
  trustEN: string
  trustOnline: string
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="max-w-2xl">
          <p className="text-sm font-medium tracking-wide text-primary uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-heading text-4xl leading-[1.05] font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/experts">
                {ctaPrimary}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/become-partner">{ctaSecondary}</Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              {trustEN}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              {trustOnline}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

async function ValueProps() {
  const t = await getTranslations("home.valueProps")
  const items: Array<{
    key: "trust" | "languages" | "instant"
    icon: React.ComponentType<{ className?: string }>
  }> = [
    { key: "trust", icon: ShieldCheck },
    { key: "languages", icon: Languages },
    { key: "instant", icon: Clock },
  ]
  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {items.map(({ key, icon: Icon }) => (
            <Card key={key} className="border-border/60">
              <CardHeader>
                <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <CardTitle>{t(`items.${key}.title`)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`items.${key}.body`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

function CategoriesPreview({
  title,
  subtitle,
  viewAllLabel,
  categories,
}: {
  title: string
  subtitle: string
  viewAllLabel: string
  categories: Array<{
    slug: string
    icon: string | null
    name: string
    description: string | null
  }>
}) {
  if (categories.length === 0) return null
  return (
    <section className="bg-muted/30 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Button variant="ghost" asChild className="hidden sm:inline-flex">
            <Link href="/experts">
              {viewAllLabel}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/experts/${c.slug}`}
                className="group block rounded-2xl focus-visible:ring-3 focus-visible:ring-ring"
              >
                <Card className="border-border/60 transition-colors group-hover:shadow-md hover:border-primary/40">
                  <CardHeader>
                    <CardTitle className="font-heading text-lg">
                      {c.name}
                    </CardTitle>
                    {c.description ? (
                      <CardDescription className="line-clamp-2">
                        {c.description}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function PartnerCta({
  title,
  body,
  cta,
}: {
  title: string
  body: string
  cta: string
}) {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="rounded-3xl border border-border/60 bg-primary/5 p-10 text-center">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            {body}
          </p>
          <div className="mt-6 flex justify-center">
            <Button size="lg" asChild>
              <Link href="/become-partner">
                {cta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * The marketplace home page renders even before the DB is ready (e.g.
 * preview deployments without env vars). Swallow query errors and fall
 * back to an empty list rather than crashing the marketing surface.
 */
async function safeListCategories() {
  try {
    return await listCategories()
  } catch {
    return []
  }
}
