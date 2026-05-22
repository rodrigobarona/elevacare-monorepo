"use server"

import { requireSession } from "@eleva/auth/server"
import { getAuthedApiClient } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"
import { allowedOnboardingStepNames } from "@/app/[orgSlug]/setup/onboarding-steps"

const ALLOWED_SESSION_MODES = ["online", "in_person", "phone"] as const

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
  try {
    const session = await requireSession("expert:onboard")

    const validSessionModes = (
      Array.isArray(data.sessionModes) ? data.sessionModes : []
    ).filter((m): m is (typeof ALLOWED_SESSION_MODES)[number] =>
      (ALLOWED_SESSION_MODES as readonly string[]).includes(m)
    )

    const api = await getAuthedApiClient()
    await api.experts.profile.patch({
      nif: data.nif ?? null,
      licenseScope: data.licenseScope ?? null,
      languages: data.languages,
      practiceCountries: data.practiceCountries,
      worldwideMode: data.worldwideMode,
      sessionModes:
        validSessionModes.length > 0 ? validSessionModes : ["online"],
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
  if (!allowedOnboardingStepNames.has(stepName)) {
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
  try {
    const session = await requireSession("expert:onboard")
    const api = await getAuthedApiClient()
    await api.experts.profile.setInvoicing({ provider })

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
