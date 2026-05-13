import { Button } from "@eleva/ui/components/button"
import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { SiteHeader } from "@/components/site-header"

type Props = {
  params: Promise<{ locale: string }>
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader nav={[{ href: "/about", labelKey: "about" }]} />
      <HomeContent />
    </div>
  )
}

function HomeContent() {
  const t = useTranslations()

  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <p className="mb-4 text-sm font-medium tracking-widest text-primary uppercase">
          {t("home.eyebrow")}
        </p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          {t("home.heading")}
          <span className="text-primary">{t("home.headingAccent")}</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          {t("home.description")}
        </p>
        <div className="mt-10 flex gap-4">
          <Button size="lg">
            {t("home.cta")}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button variant="outline" size="lg">
            {t("home.ctaSecondary")}
          </Button>
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
