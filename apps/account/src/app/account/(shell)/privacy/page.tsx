import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import {
  SettingsFieldset,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"

export default async function PrivacyPage() {
  const t = await getTranslations("privacy")

  return (
    <>
      <AccountPageHeader title={t("title")} description={t("description")} />
      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("description")}
          </SettingsFieldsetDescription>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("placeholder")}
          </p>
        </SettingsFieldsetContent>
      </SettingsFieldset>
    </>
  )
}
