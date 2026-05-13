import { getTranslations } from "next-intl/server"
import { Button } from "@eleva/ui/components/button"
import { Link } from "@/i18n/navigation"

export default async function NotFoundPage() {
  const t = await getTranslations("profile.notFound")

  return (
    <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
        {t("title")}
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">{t("body")}</p>
      <div className="mt-6">
        <Button asChild>
          <Link href="/experts">{t("back")}</Link>
        </Button>
      </div>
    </section>
  )
}
