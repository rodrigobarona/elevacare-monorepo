import { getTranslations } from "next-intl/server"
import { WorkspaceTypePicker } from "@eleva/dashboard/workspace-type-picker"

export default async function NewWorkspacePage() {
  const t = await getTranslations("createWorkspace")

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-3xl space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("pickerTitle")}
          </h1>
          <p className="text-muted-foreground">{t("pickerDescription")}</p>
        </div>
        <WorkspaceTypePicker mode="page" />
      </div>
    </main>
  )
}
