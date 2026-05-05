import { getTranslations } from "next-intl/server"

import { Link } from "@/i18n/navigation"

interface FooterLink {
  href: string
  key: string
}

const exploreLinks: FooterLink[] = [
  { href: "/experts", key: "footer.links.experts" },
  { href: "/become-partner", key: "footer.links.becomePartner" },
]

const companyLinks: FooterLink[] = [
  { href: "/about", key: "footer.links.about" },
]

const legalLinks: FooterLink[] = [
  { href: "/legal/privacy", key: "footer.links.privacy" },
  { href: "/legal/terms", key: "footer.links.terms" },
  { href: "/legal/cookies", key: "footer.links.cookies" },
]

export async function SiteFooter() {
  const t = await getTranslations()
  const year = new Date().getUTCFullYear()

  return (
    <footer className="mt-16 border-t border-border/60 bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <p className="font-heading text-lg font-semibold text-foreground">
            {t("site.name")}
          </p>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {t("footer.tagline")}
          </p>
          <p className="mt-4 text-xs text-muted-foreground/80">
            {t("footer.registeredIn")}
          </p>
        </div>

        <FooterColumn title={t("footer.explore")} links={exploreLinks} />
        <FooterColumn title={t("footer.company")} links={companyLinks} />
        <FooterColumn title={t("footer.legal")} links={legalLinks} />
      </div>
      <div className="border-t border-border/60">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted-foreground sm:px-6">
          {t("footer.copyright", { year })}
        </p>
      </div>
    </footer>
  )
}

async function FooterColumn({
  title,
  links,
}: {
  title: string
  links: FooterLink[]
}) {
  const t = await getTranslations()
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(l.key)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
