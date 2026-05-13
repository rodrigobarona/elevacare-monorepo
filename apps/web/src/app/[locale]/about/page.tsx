import { Button } from "@eleva/ui/components/button"
import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
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

const stats = [
  { value: "100%", key: "online" },
  { value: "3+", key: "languages" },
  { value: "4", key: "specialities" },
] as const

const valueKeys = [
  "evidenceBased",
  "accessible",
  "humanCentred",
  "inclusive",
] as const

export default async function AboutPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader nav={[{ href: "/", labelKey: "home" }]} />
      <AboutContent />
    </div>
  )
}

function AboutContent() {
  const t = useTranslations()

  return (
    <>
      <main className="flex-1">
        <section className="px-6 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <p className="mb-4 text-sm font-medium tracking-widest text-primary uppercase">
              {t("about.eyebrow")}
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              {t("about.heading")}
              <span className="text-primary">{t("about.headingAccent")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              {t("about.intro")}
            </p>
          </div>
        </section>

        <section className="border-y bg-muted/40 px-6 py-12">
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.key} className="text-center">
                <p className="text-3xl font-bold text-primary">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`about.stats.${stat.key}`)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
              {t("about.valuesHeading")}
            </h2>
            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2">
              {valueKeys.map((key) => (
                <div key={key} className="rounded-lg border p-6">
                  <h3 className="text-lg font-semibold">
                    {t(`about.values.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(`about.values.${key}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-muted/40 px-6 py-24 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("about.ctaHeading")}
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              {t("about.ctaDescription")}
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button size="lg" asChild>
                <Link href="/">
                  {t("about.cta")}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
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
