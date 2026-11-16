import { getTranslations } from "next-intl/server"
import { WorkspaceTypePicker } from "@eleva/dashboard/workspace-type-picker"
import { findExistingPractice } from "@eleva/dashboard/existing-practice"
import { getUserOrganizations } from "@eleva/auth/server"
import { AuthHeading } from "@/components/auth-ui"

export default async function NewWorkspacePage() {
  const [t, organizations] = await Promise.all([
    getTranslations("createWorkspace"),
    getUserOrganizations(),
  ])

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-16"
      data-testid="workspaces-new"
    >
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center">
          <AuthHeading
            title={t("pickerTitle")}
            description={t("pickerDescription")}
          />
        </div>
        <WorkspaceTypePicker
          mode="page"
          existingPractice={findExistingPractice(organizations ?? [])}
        />
      </div>
    </main>
  )
}
