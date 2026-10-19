"use client"

import { useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { PatchExpertProfileRequest } from "@eleva/api-client"
import { savePublicProfile } from "./actions"

export type PublicProfilePatch = Pick<
  PatchExpertProfileRequest,
  | "displayName"
  | "headline"
  | "bioRich"
  | "avatarUrl"
  | "socialLinks"
  | "credentials"
>

/** Saves one section of the public profile and reports it with a toast. */
export function useProfileSave() {
  const t = useTranslations("publicProfile")
  const [isSaving, startSaving] = useTransition()

  function save(
    patch: PublicProfilePatch,
    options: { success?: string; onSaved?: () => void } = {}
  ) {
    startSaving(async () => {
      const result = await savePublicProfile(patch)
      if (!result.ok) {
        toast.error(result.message ?? t("saveFailed"))
        return
      }
      toast.success(options.success ?? t("saved"))
      options.onSaved?.()
    })
  }

  return { isSaving, save }
}
