import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { SetupShell } from "@/components/setup-shell"
import { CreateWorkspaceForm } from "./create-workspace-form"

const workspaceTypes = ["expert", "team", "academy"] as const

type WorkspaceType = (typeof workspaceTypes)[number]

function isWorkspaceType(value: string): value is WorkspaceType {
  return workspaceTypes.includes(value as WorkspaceType)
}

export default async function CreateWorkspacePage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = await params
  if (!isWorkspaceType(type)) notFound()

  const t = await getTranslations("createWorkspace")

  return (
    <SetupShell
      backHref="/account/workspaces/new"
      step={2}
      totalSteps={2}
      title={t(`types.${type}.wizardTitle`)}
      description={t(`types.${type}.wizardDescription`)}
    >
      <CreateWorkspaceForm type={type} />
    </SetupShell>
  )
}
