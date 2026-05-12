import { getTranslations } from "next-intl/server"
import { getWidgetTokenFromSession } from "@eleva/auth/server"
import { SettingsWidgets } from "./settings-widgets"

export default async function SettingsPage() {
  const t = await getTranslations()
  const authToken = await getWidgetTokenFromSession()

  return (
    <>
      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-medium">{t("settings.title")}</h1>
      </header>
      <SettingsWidgets authToken={authToken} />
    </>
  )
}
