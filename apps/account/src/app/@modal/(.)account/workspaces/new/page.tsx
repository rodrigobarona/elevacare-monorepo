import { CreateWorkspaceInterceptModal } from "@eleva/dashboard/create-workspace-modal"
import { findExistingPractice } from "@eleva/dashboard/existing-practice"
import { getUserOrganizations } from "@eleva/auth/server"

export default async function NewWorkspaceModalPage() {
  const organizations = (await getUserOrganizations()) ?? []
  return (
    <CreateWorkspaceInterceptModal
      existingPractice={findExistingPractice(organizations)}
    />
  )
}
