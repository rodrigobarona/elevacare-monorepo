import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { AccountPageHeader } from "@eleva/dashboard"
import { Button } from "@eleva/ui/components/button"
import {
  SettingsFieldset,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"

export default async function OrganizationsPage() {
  const t = await getTranslations("organizations")

  return (
    <>
      <AccountPageHeader title={t("title")} description={t("description")} />
      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("description")}
          </SettingsFieldsetDescription>
          <div className="mt-6">
            <Button asChild>
              <Link href="/account/workspaces/new">{t("createWorkspace")}</Link>
            </Button>
          </div>
        </SettingsFieldsetContent>
      </SettingsFieldset>
    </>
  )
}
