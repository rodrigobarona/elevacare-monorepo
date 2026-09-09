import { CONSENT_DOCUMENT_VERSION } from "@eleva/compliance"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { LEGAL_SLUGS } from "@/lib/legal-slugs"

const FOOTER_LABEL_KEYS = {
  terms: "terms",
  privacy: "privacy",
  "health-data": "healthData",
  cookies: "cookies",
  payments: "payments",
  "expert-agreement": "expertAgreement",
} as const

export async function SiteFooter() {
  const t = await getTranslations("footer")
  const year = new Date().getFullYear().toString()

  return (
    <footer className="border-t px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <nav
          aria-label={t("legal")}
          className="flex flex-wrap justify-center gap-x-4 gap-y-2"
        >
          {LEGAL_SLUGS.map((slug) => (
            <Link
              key={slug}
              href={`/legal/${slug}`}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(FOOTER_LABEL_KEYS[slug])}
            </Link>
          ))}
        </nav>
        <nav
          data-testid="footer-solutions"
          aria-label={t("solutions")}
          className="flex flex-wrap justify-center gap-x-4 gap-y-2"
        >
          <Link
            href="/become-expert"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("becomeExpert")}
          </Link>
          <Link
            href="/for-clinics"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("forClinics")}
          </Link>
        </nav>
        <p className="text-center text-sm text-muted-foreground">
          {t("rights", { year })}
        </p>
        <p className="text-center text-xs text-muted-foreground">
          {t("draftNote", { version: CONSENT_DOCUMENT_VERSION })}
        </p>
      </div>
    </footer>
  )
}
