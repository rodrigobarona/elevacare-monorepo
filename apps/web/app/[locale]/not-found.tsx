import { getTranslations } from "next-intl/server"

import { Button } from "@eleva/ui/components/button"
import { Link } from "@/i18n/navigation"

export default async function LocaleNotFound() {
  const t = await getTranslations()
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-xl flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {t("profile.notFound.title")}
      </h1>
      <p className="mt-3 text-base text-muted-foreground">
        {t("profile.notFound.body")}
      </p>
      <Button className="mt-8" asChild>
        <Link href="/experts">{t("profile.notFound.back")}</Link>
      </Button>
    </div>
  )
}
