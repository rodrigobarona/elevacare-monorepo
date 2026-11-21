"use server"

import { revalidatePath } from "next/cache"
import {
  ApiClientError,
  FileClinicVerificationRequestSchema,
} from "@eleva/api-client"
import { resolveTeamWorkspaceBase } from "@eleva/auth/org-routing"
import {
  getWorkspaceApiClient,
  requireWorkspaceSession,
} from "@eleva/dashboard/workspace-api"

export type FileVerificationError =
  | "validation"
  | "invalid-tax-id"
  | "changed"
  | "unchanged"
  | "failed"

/** Send (or send again) the clinic's legal name and tax number. */
export async function fileVerification(input: {
  legalName: string
  taxId: string
}): Promise<{ ok: true } | { ok: false; error: FileVerificationError }> {
  const parsed = FileClinicVerificationRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "validation" }
  // The page to refresh: after a send, and when the API says the page was
  // showing an older state than the one it has.
  let page: string | null = null
  try {
    const session = await requireWorkspaceSession("clinic:manage")
    page = session.orgSlug
      ? `${resolveTeamWorkspaceBase(session.orgSlug)}/verification`
      : null
    const api = await getWorkspaceApiClient()
    await api.teams.fileVerification(session.orgId, parsed.data)
    if (page) revalidatePath(page)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.body.error === "INVALID_TAX_ID") {
        return { ok: false, error: "invalid-tax-id" }
      }
      const stale =
        err.body.error === "VERIFICATION_LOCKED"
          ? "changed"
          : err.body.error === "VERIFICATION_UNCHANGED"
            ? "unchanged"
            : null
      if (stale) {
        if (page) revalidatePath(page)
        return { ok: false, error: stale }
      }
      if (err.status === 422) return { ok: false, error: "validation" }
    }
    console.error("[team] fileVerification failed", err)
    return { ok: false, error: "failed" }
  }
}
