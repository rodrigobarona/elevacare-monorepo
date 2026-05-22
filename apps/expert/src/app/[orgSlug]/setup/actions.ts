"use server"

import { requireSession } from "@eleva/auth/server"
import { getExpertProfileForOrg, updateExpertProfile } from "@eleva/db"
import { getAuthedApiClient } from "@/lib/server-api"
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
    const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
    if (!profile) return { ok: false, error: "no-profile" }

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
    return { ok: false, error: "save-failed" }
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
    const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
    if (!profile) return { ok: false, error: "no-profile" }

    const completedSteps = (profile.metadata as Record<string, unknown>)
      ?.completedSteps
    const steps = Array.isArray(completedSteps) ? completedSteps : []
    if (!steps.includes(stepName)) steps.push(stepName)

    await updateExpertProfile(profile.id, profile.orgId, {
      metadata: { ...(profile.metadata ?? {}), completedSteps: steps },
    })

    revalidateExpertWorkspace(session, "setup")
    return { ok: true }
  } catch (err) {
    console.error("[onboarding] markStepComplete failed", err)
    return { ok: false, error: "save-failed" }
  }
}

export async function saveInvoicingChoice(
  provider: "toconline" | "moloni" | "manual"
): Promise<ActionResult> {
  try {
    const session = await requireSession("expert:onboard")
    const profile = await getExpertProfileForOrg(session.user.id, session.orgId)
    if (!profile) return { ok: false, error: "no-profile" }

    const api = await getAuthedApiClient()
    await api.experts.profile.setInvoicing({ provider })

    revalidateExpertWorkspace(session, "setup")
    return { ok: true }
  } catch (err) {
    console.error("[onboarding] saveInvoicingChoice failed", err)
    return { ok: false, error: "save-failed" }
  }
}
