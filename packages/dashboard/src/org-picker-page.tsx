import { getUserOrganizations } from "@eleva/auth/server"
import { getTranslations } from "next-intl/server"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eleva/ui/components/empty"
import { OrgSwitcher } from "@eleva/dashboard/org-switcher"
import { Building2 } from "@eleva/icons"

export async function OrgPickerPage() {
  const [organizations, t] = await Promise.all([
    getUserOrganizations(),
    getTranslations("picker"),
  ])

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2 />
          </EmptyMedia>
          <EmptyTitle>{t("title")}</EmptyTitle>
          <EmptyDescription>{t("description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="w-full">
          {organizations.length > 0 ? (
            <OrgSwitcher organizations={organizations} />
          ) : null}
        </EmptyContent>
      </Empty>
    </main>
  )
}
