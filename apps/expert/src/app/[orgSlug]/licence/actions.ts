"use server"

import { ApiClientError, ExpertLicenceSchema } from "@eleva/api-client"
import { requireSession } from "@eleva/auth/server"
import { getAuthedApiClient } from "@/lib/server-api"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

export type SubmitLicenceError =
  | "validation"
  | "locked"
  | "not-eligible"
  | "failed"

export async function submitLicence(input: {
  professionalBody: string
  licenceNumber: string
  ersRegistrationNumber: string
}): Promise<{ ok: true } | { ok: false; error: SubmitLicenceError }> {
  const parsed = ExpertLicenceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "validation" }

  try {
    const session = await requireSession("expert:onboard")
    const api = await getAuthedApiClient()
    await api.expert.profile.submitLicence(parsed.data)
    revalidateExpertWorkspace(session, "licence")
    return { ok: true }
  } catch (err) {
    console.error("[licence] submitLicence failed", err)
    if (err instanceof ApiClientError) {
      if (err.body.error === "LICENCE_LOCKED") {
        return { ok: false, error: "locked" }
      }
      if (
        err.body.error === "SETUP_INCOMPLETE" ||
        err.body.error === "PROFILE_NOT_ELIGIBLE"
      ) {
        return { ok: false, error: "not-eligible" }
      }
      if (err.status === 422) return { ok: false, error: "validation" }
    }
    return { ok: false, error: "failed" }
  }
}
