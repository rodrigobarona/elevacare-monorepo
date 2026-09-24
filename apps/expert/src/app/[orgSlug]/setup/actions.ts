"use server"

import { requireSession } from "@eleva/auth/server"
import {
  InvoicingRequestSchema,
  PatchExpertProfileRequestSchema,
  PatchPracticeRequestSchema,
  ConnectAccountingProviderSchema,
  ApiClientError,
} from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"
import { isOnboardingStepName } from "@/app/[orgSlug]/setup/onboarding-steps"

interface ProfileFormData {
  nif?: string
  sessionModes: string[]
}

interface PracticeFormData {
  practiceCountry: string
  serviceCountries: string[]
  languages: string[]
  licenseScope: string | null
  worldwideRemote: boolean
}

type ActionResult = { ok: true } | { ok: false; error: string }

export async function saveProfileStep(
  data: ProfileFormData
): Promise<ActionResult> {
  let payload
  try {
    payload = PatchExpertProfileRequestSchema.parse({
      nif: data.nif ?? null,
      sessionModes: data.sessionModes,
    })
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    const session = await requireSession("expert:onboard")
    const api = await getAuthedApiClient()
    await api.expert.profile.patch({
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

export async function savePracticeStep(
  data: PracticeFormData
): Promise<ActionResult> {
  let payload
  try {
    payload = PatchPracticeRequestSchema.parse({
      practiceCountry: data.practiceCountry,
      serviceCountries: data.serviceCountries,
      languages: data.languages,
      licenseScope: data.licenseScope,
      worldwideRemote: data.worldwideRemote,
    })
  } catch {
    return { ok: false, error: "validation" }
  }

  if (!payload.practiceCountry || !payload.languages?.length) {
    return { ok: false, error: "required" }
  }

  try {
    const session = await requireSession("expert:onboard")
    const api = await getAuthedApiClient()
    await api.expert.practice.patch(payload)
    await api.expert.profile.completeStep("practice")

    revalidateExpertWorkspace(session, "setup")
    return { ok: true }
  } catch (err) {
    console.error("[onboarding] savePracticeStep failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "save-failed", {
        offerInvariant: "offer-invariant",
        validation: "validation",
      }),
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
    await api.expert.profile.completeStep(stepName)

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
  provider: "toconline" | "moloni" | "manual",
  acknowledged?: boolean
): Promise<ActionResult> {
  let payload
  try {
    payload = InvoicingRequestSchema.parse(
      provider === "manual" ? { provider, acknowledged } : { provider }
    )
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    const session = await requireSession("expert:onboard")
    const api = await getAuthedApiClient()
    await api.expert.profile.setInvoicing(payload)

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

export async function startToconlineOAuth(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  let provider
  try {
    provider = ConnectAccountingProviderSchema.parse("toconline")
  } catch {
    return { ok: false, error: "validation" }
  }

  try {
    await requireSession("expert:invoicing_manage")
    const api = await getAuthedApiClient()
    const result = await api.accounting.connect(provider)
    return { ok: true, url: result.url }
  } catch (err) {
    console.error("[onboarding] startToconlineOAuth failed", err)
    if (err instanceof ApiClientError) {
      if (err.body.error === "flag_disabled") {
        return { ok: false, error: "flag_disabled" }
      }
      if (err.status === 404) {
        return { ok: false, error: "not_found" }
      }
    }
    return { ok: false, error: "connect_failed" }
  }
}
