"use server"

import { requireSession } from "@eleva/auth/server"
import {
  InvoicingRequestSchema,
  PatchExpertProfileRequestSchema,
} from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"
import { isOnboardingStepName } from "@/app/[orgSlug]/setup/onboarding-steps"

interface ProfileFormData {
  nif?: string
  licenseScope?: string
  languages: string[]
  practiceCountries: string[]
  worldwideMode: boolean
  sessionModes: string[]
}

type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveProfileStep(
  data: ProfileFormData
): Promise<ActionResult> {
  let payload
  try {
    payload = PatchExpertProfileRequestSchema.parse({
      nif: data.nif ?? null,
      licenseScope: data.licenseScope ?? null,
      languages: data.languages,
      practiceCountries: data.practiceCountries,
      worldwideMode: data.worldwideMode,
      sessionModes: data.sessionModes,
    })
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    const session = await requireSession("expert:onboard")
    const api = await getAuthedApiClient()
    await api.experts.profile.patch({
      ...payload,
      sessionModes:
        payload.sessionModes && payload.sessionModes.length > 0
          ? payload.sessionModes
          : ["online"],
    })

    revalidateExpertWorkspace(session, "setup")
    return { ok: true }
  } catch (err) {
    console.error("[onboarding] saveProfileStep failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "save-failed"),
    }
  }
}

export async function markStepComplete(
  stepName: string
): Promise<ActionResult> {
  if (!isOnboardingStepName(stepName)) {
    return { ok: false, error: "invalid-step" }
  }

  try {
    const session = await requireSession("expert:onboard")
    const api = await getAuthedApiClient()
    await api.experts.profile.completeStep(stepName)

    revalidateExpertWorkspace(session, "setup")
    return { ok: true }
  } catch (err) {
    console.error("[onboarding] markStepComplete failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "save-failed", {
        validation: "invalid-step",
      }),
    }
  }
}

export async function saveInvoicingChoice(
  provider: "toconline" | "moloni" | "manual"
): Promise<ActionResult> {
  let payload
  try {
    payload = InvoicingRequestSchema.parse({ provider })
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    const session = await requireSession("expert:onboard")
    const api = await getAuthedApiClient()
    await api.experts.profile.setInvoicing(payload)

    revalidateExpertWorkspace(session, "setup")
    return { ok: true }
  } catch (err) {
    console.error("[onboarding] saveInvoicingChoice failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "save-failed"),
    }
  }
}
