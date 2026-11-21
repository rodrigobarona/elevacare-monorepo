"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ApiClientError, ClinicDecisionRequestSchema } from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"

export type DecideClinicError =
  | "validation"
  | "changed"
  | "decided"
  | "self"
  | "step-up"
  | "forbidden"
  | "failed"

const API_ERRORS: Record<string, DecideClinicError> = {
  VERIFICATION_CHANGED: "changed",
  VERIFICATION_ALREADY_DECIDED: "decided",
  SELF_REVIEW: "self",
  STEP_UP_REQUIRED: "step-up",
}

const IdSchema = z.string().uuid()

export async function decideClinic(
  verificationId: string,
  input: unknown
): Promise<{ ok: true } | { ok: false; error: DecideClinicError }> {
  const id = IdSchema.safeParse(verificationId)
  const parsed = ClinicDecisionRequestSchema.safeParse(input)
  if (!id.success || !parsed.success) return { ok: false, error: "validation" }

  try {
    const api = await getAuthedApiClient()
    await api.admin.clinics.decide(id.data, parsed.data)
    revalidatePath("/clinics")
    revalidatePath(`/clinics/${id.data}`)
    return { ok: true }
  } catch (err) {
    console.error("[clinics] decideClinic failed", err)
    if (err instanceof ApiClientError) {
      const code = API_ERRORS[String(err.body.error)]
      if (code) return { ok: false, error: code }
      if (err.status === 403) return { ok: false, error: "forbidden" }
      if (err.status === 422) return { ok: false, error: "validation" }
    }
    return { ok: false, error: "failed" }
  }
}
