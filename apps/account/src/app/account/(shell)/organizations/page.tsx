import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { PageHeader } from "@eleva/ui/components/page-header"
import { buttonVariants } from "@eleva/ui/components/button-variants"
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
      <PageHeader title={t("title")} description={t("description")} />
      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("description")}
          </SettingsFieldsetDescription>
          <div className="mt-6">
            <Link href="/account/workspaces/new" className={buttonVariants()}>
              {t("createWorkspace")}
            </Link>
          </div>
        </SettingsFieldsetContent>
      </SettingsFieldset>
    </>
  )
}
