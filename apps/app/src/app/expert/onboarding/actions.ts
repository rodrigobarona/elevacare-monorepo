"use server"

import { revalidatePath } from "next/cache"
import { requireSession } from "@eleva/auth/server"
import { getExpertProfileByUserId, updateExpertProfile } from "@eleva/db"

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
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const completedSteps = (profile.metadata as Record<string, unknown>)
      ?.completedSteps
    const steps = Array.isArray(completedSteps) ? completedSteps : []
    if (!steps.includes("profile")) steps.push("profile")

    const validSessionModes = (
      Array.isArray(data.sessionModes) ? data.sessionModes : []
    ).filter((m): m is (typeof ALLOWED_SESSION_MODES)[number] =>
      (ALLOWED_SESSION_MODES as readonly string[]).includes(m)
    )

    await updateExpertProfile(profile.id, profile.orgId, {
      nif: data.nif ?? null,
      licenseScope: data.licenseScope ?? null,
      languages: data.languages,
      practiceCountries: data.practiceCountries,
      worldwideMode: data.worldwideMode,
      sessionModes:
        validSessionModes.length > 0 ? validSessionModes : ["online"],
      metadata: { ...(profile.metadata ?? {}), completedSteps: steps },
    })

    revalidatePath("/expert/onboarding")
    return { ok: true }
  } catch (err) {
    console.error("[onboarding] saveProfileStep failed", err)
    return { ok: false, error: "save-failed" }
  }
}

export async function markStepComplete(
  stepName: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("expert:onboard")
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const completedSteps = (profile.metadata as Record<string, unknown>)
      ?.completedSteps
    const steps = Array.isArray(completedSteps) ? completedSteps : []
    if (!steps.includes(stepName)) steps.push(stepName)

    await updateExpertProfile(profile.id, profile.orgId, {
      metadata: { ...(profile.metadata ?? {}), completedSteps: steps },
    })

    revalidatePath("/expert/onboarding")
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
    const profile = await getExpertProfileByUserId(session.user.id)
    if (!profile) return { ok: false, error: "no-profile" }

    const completedSteps = (profile.metadata as Record<string, unknown>)
      ?.completedSteps
    const steps = Array.isArray(completedSteps) ? completedSteps : []
    if (!steps.includes("invoicing")) steps.push("invoicing")

    await updateExpertProfile(profile.id, profile.orgId, {
      invoicingProvider: provider,
      invoicingSetupStatus:
        provider === "manual" ? "manual_acknowledged" : "connecting",
      metadata: {
        ...(profile.metadata ?? {}),
        completedSteps: steps,
        invoicingProvider: provider,
      },
    })

    revalidatePath("/expert/onboarding")
    return { ok: true }
  } catch (err) {
    console.error("[onboarding] saveInvoicingChoice failed", err)
    return { ok: false, error: "save-failed" }
  }
}
