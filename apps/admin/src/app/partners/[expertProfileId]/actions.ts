"use server"

import { revalidatePath } from "next/cache"
import { ApiClientError, LicenceDecisionRequestSchema } from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"

export type DecideLicenceError =
  | "validation"
  | "changed"
  | "decided"
  | "self"
  | "forbidden"
  | "failed"

const API_ERRORS: Record<string, DecideLicenceError> = {
  APPLICATION_CHANGED: "changed",
  APPLICATION_ALREADY_DECIDED: "decided",
  SELF_REVIEW: "self",
}

export async function decideLicence(
  expertProfileId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: DecideLicenceError }> {
  const parsed = LicenceDecisionRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "validation" }

  try {
    const api = await getAuthedApiClient()
    await api.admin.partners.decide(expertProfileId, parsed.data)
    revalidatePath("/partners")
    return { ok: true }
  } catch (err) {
    console.error("[partners] decideLicence failed", err)
    if (err instanceof ApiClientError) {
      const code = API_ERRORS[String(err.body.error)]
      if (code) return { ok: false, error: code }
      if (err.status === 403) return { ok: false, error: "forbidden" }
      if (err.status === 422) return { ok: false, error: "validation" }
    }
    return { ok: false, error: "failed" }
  }
}
