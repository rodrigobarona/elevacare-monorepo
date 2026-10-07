import { getTranslations } from "next-intl/server"
import { buttonVariants } from "@eleva/ui/components/button-variants"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { Link } from "@/i18n/navigation"

export default async function NotFound() {
  const t = await getTranslations("notFound")

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        nav={[
          { href: "/", labelKey: "home" },
          { href: "/experts", labelKey: "experts" },
        ]}
      />
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center px-6 py-16">
        <EmptyState
          variant="no-results"
          title={t("title")}
          description={t("description")}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/experts" className={buttonVariants()}>
                {t("findExpert")}
              </Link>
              <Link href="/" className={buttonVariants({ variant: "outline" })}>
                {t("home")}
              </Link>
            </div>
          }
        />
      </main>
      <SiteFooter />
    </div>
  )
}
