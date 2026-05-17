import { getTranslations } from "next-intl/server"
import { guardSession } from "@eleva/auth"

export default async function OrganizationsPage() {
  await guardSession()

  const t = await getTranslations("organizations")

  return (
    <>
      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>
      <p className="text-muted-foreground">{t("placeholder")}</p>
    </>
  )
}
