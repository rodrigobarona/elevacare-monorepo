import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { getSession } from "@eleva/auth/server"

export default async function OrganizationsPage() {
  const session = await getSession()
  if (!session) redirect("/signin")

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
