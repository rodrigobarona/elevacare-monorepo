"use server"

import { mintUploadToken } from "@eleva/auth/upload-token"
import { requireSession } from "@eleva/auth/server"
import { PatchExpertProfileRequestSchema } from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"
import { humanApiMessage, mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

const PublicProfileUpdateSchema = PatchExpertProfileRequestSchema.pick({
  displayName: true,
  headline: true,
  bioRich: true,
  avatarUrl: true,
  socialLinks: true,
  credentials: true,
})

export type PublicProfileActionResult =
  | { ok: true }
  | { ok: false; error: string; message?: string }

export async function getPortraitUploadToken(): Promise<{
  token: string
  ownerId: string
}> {
  const session = await requireSession("expert:onboard")
  return {
    token: await mintUploadToken(session.user.id),
    ownerId: session.user.id,
  }
}

export async function savePublicProfile(
  input: unknown
): Promise<PublicProfileActionResult> {
  const parsed = PublicProfileUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "validation",
      message: parsed.error.issues[0]?.message,
    }
  }

  try {
    const session = await requireSession("expert:onboard")
    const api = await getAuthedApiClient()
    await api.expert.profile.patch(parsed.data)
    revalidateExpertWorkspace(session, "profile")
    return { ok: true }
  } catch (err) {
    console.error("[profile] savePublicProfile failed", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "save-failed", {
        validation: "validation",
      }),
      message: humanApiMessage(err),
    }
  }
}
