import { CreateWorkspaceInterceptModal } from "@eleva/dashboard/create-workspace-modal"
import { loadExistingPractice } from "@eleva/dashboard/existing-practice"
import { getAuthUser } from "@eleva/auth/server"

export default async function NewWorkspaceModalPage() {
  const user = await getAuthUser()
  const existingPractice = user ? await loadExistingPractice(user.id) : null
  return <CreateWorkspaceInterceptModal existingPractice={existingPractice} />
}
