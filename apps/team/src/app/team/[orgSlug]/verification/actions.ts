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
  try {
    const session = await requireWorkspaceSession("clinic:manage")
    const api = await getWorkspaceApiClient()
    await api.teams.fileVerification(session.orgId, parsed.data)
    if (session.orgSlug) {
      revalidatePath(
        `${resolveTeamWorkspaceBase(session.orgSlug)}/verification`
      )
    }
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.body.error === "INVALID_TAX_ID") {
        return { ok: false, error: "invalid-tax-id" }
      }
      if (err.body.error === "VERIFICATION_LOCKED") {
        return { ok: false, error: "changed" }
      }
      if (err.body.error === "VERIFICATION_UNCHANGED") {
        return { ok: false, error: "unchanged" }
      }
      if (err.status === 422) return { ok: false, error: "validation" }
    }
    console.error("[team] fileVerification failed", err)
    return { ok: false, error: "failed" }
  }
}
