import { Button } from "@eleva/ui/components/button"
import { ArrowRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { setRequestLocale } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { LanguageSwitcher } from "@/components/language-switcher"

type Props = {
  params: Promise<{ locale: string }>
}

export default async function Home({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return <HomeContent />
}

function HomeContent() {
  const t = useTranslations()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">
            eleva<span className="text-primary">.care</span>
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/about"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("nav.about")}
            </Link>
            <LanguageSwitcher />
            <Button variant="outline" size="sm">
              {t("nav.signin")}
            </Button>
          </div>
        </nav>
      </header>

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
    </div>
  )
}
