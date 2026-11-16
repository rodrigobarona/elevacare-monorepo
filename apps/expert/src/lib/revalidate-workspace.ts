import { revalidatePath } from "next/cache"
import type { ElevaSession } from "@eleva/auth"
import { expertWorkspaceBase, expertWorkspacePath } from "@/lib/workspace-paths"

export function revalidateExpertWorkspace(
  session: ElevaSession,
  segment = ""
): void {
  revalidatePath(expertWorkspacePath(session, segment))
  if (session.orgSlug) {
    revalidatePath(expertWorkspaceBase(session), "layout")
  }
}
