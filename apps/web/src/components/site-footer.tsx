import type { ReactNode } from "react"
import { CONSENT_DOCUMENT_VERSION } from "@eleva/compliance"
import { COMMUNITY_EXTERNAL_LINKS } from "@eleva/config/public-site-parity"
import { Logo } from "@eleva/ui/components/brand"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { LEGAL_SLUGS } from "@/lib/legal-slugs"

const FOOTER_LABEL_KEYS = {
  terms: "terms",
  privacy: "privacy",
  "health-data": "healthData",
  "ai-processing": "aiProcessing",
  cookies: "cookies",
  payments: "payments",
  "expert-agreement": "expertAgreement",
  accessibility: "accessibility",
  complaints: "complaints",
} as const

const LINK_CLASS =
  "text-sm text-muted-foreground transition-colors hover:text-foreground"

function FooterColumn({
  title,
  testId,
  children,
}: {
  title: string
  testId?: string
  children: ReactNode
}) {
  return (
    <nav
      aria-label={title}
      data-testid={testId}
      className="flex flex-col gap-3"
    >
      <p className="eyebrow text-foreground">{title}</p>
      {children}
    </nav>
  )
}

export async function SiteFooter() {
  const t = await getTranslations("footer")
  const year = new Date().getFullYear().toString()

  return (
    <footer className="border-t bg-muted/60 px-4 pt-16 pb-10 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="flex max-w-xs flex-col gap-4">
            <Link href="/" aria-label="Eleva.care" className="w-fit rounded-sm">
              <Logo className="h-7" />
            </Link>
            <p className="text-sm text-pretty text-muted-foreground">
              {t("tagline")}
            </p>
          </div>
          <FooterColumn title={t("solutions")} testId="footer-solutions">
            <Link href="/about" className={LINK_CLASS}>
              {t("about")}
            </Link>
            <Link href="/history" className={LINK_CLASS}>
              {t("story")}
            </Link>
            <Link href="/become-expert" className={LINK_CLASS}>
              {t("becomeExpert")}
            </Link>
            <Link href="/for-clinics" className={LINK_CLASS}>
              {t("forClinics")}
            </Link>
          </FooterColumn>
          <FooterColumn title={t("legal")}>
            {LEGAL_SLUGS.map((slug) => (
              <Link key={slug} href={`/legal/${slug}`} className={LINK_CLASS}>
                {t(FOOTER_LABEL_KEYS[slug])}
              </Link>
            ))}
            <Link href="/credits" className={LINK_CLASS}>
              {t("credits")}
            </Link>
          </FooterColumn>
          <FooterColumn title={t("community")} testId="footer-community">
            {COMMUNITY_EXTERNAL_LINKS.map((link) => (
              <a
                key={link.id}
                data-testid={`footer-community-${link.id}`}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_CLASS}
              >
                {t(link.id)}
              </a>
            ))}
          </FooterColumn>
        </div>
        <div className="flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{t("rights", { year })}</p>
          <p className="max-w-xl sm:text-right">
            {t("draftNote", { version: CONSENT_DOCUMENT_VERSION })}
          </p>
        </div>
      </div>
    </footer>
  )
}
