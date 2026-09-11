"use server"

import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  ApiClientError,
  PatchMeRequestSchema,
  PutMeConsentRequestSchema,
  PutNotificationPreferencesRequestSchema,
  RescheduleMeBookingRequestSchema,
  UpdateAvatarRequestSchema,
} from "@eleva/api-client"
import { requireSession } from "@eleva/auth/server"
import { mintUploadToken } from "@eleva/auth/upload-token"
import { deletePublicBlob } from "@eleva/storage"
import {
  cookieName,
  getLocaleCookieOptions,
  isLocale,
  type Locale,
} from "@eleva/config/i18n"
import { getAuthedApiClient, requireMemberOrg } from "@/lib/member-api"

export type ActionResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : ({ ok: true } & T) | { ok: false; error: string }

const OrgSlugSchema = z.string().min(1).max(80)
const UuidSchema = z.string().uuid()

function extraCode(err: ApiClientError): string | undefined {
  const body = err.body as { code?: unknown }
  return typeof body.code === "string" ? body.code : undefined
}

function mapGenericError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 401) return "unauthorized"
    if (err.status === 404) return "notFound"
    if (err.status === 422 || err.body.error === "validation")
      return "validation"
    const code = extraCode(err) ?? err.body.error
    switch (code) {
      case "POLICY_TOO_LATE":
        return "tooLate"
      case "INVALID_STATUS":
        return "invalidStatus"
      case "SLOT_TAKEN":
        return "slotTaken"
      case "not_found":
        return "notFound"
      case "HEALTH_DATA_CONSENT_IN_USE":
        return "healthData"
      case "ACCOUNT_DELETION_ALREADY_SCHEDULED":
        return "alreadyScheduled"
      default:
        return "generic"
    }
  }
  return "generic"
}

function revalidateMember(orgSlug: string) {
  revalidatePath(`/${orgSlug}`)
  revalidatePath(`/${orgSlug}/sessions`)
  revalidatePath(`/${orgSlug}/payments`)
  revalidatePath(`/${orgSlug}/settings`)
  revalidatePath(`/${orgSlug}/privacy`)
}

const PUBLIC_BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/

async function discardOrphanPublicAvatar(url: string): Promise<void> {
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol !== "https:" ||
      !PUBLIC_BLOB_HOST.test(parsed.hostname) ||
      !parsed.pathname.includes("/avatar/profile/")
    ) {
      return
    }
    await deletePublicBlob(url)
  } catch (err) {
    console.warn("discardOrphanPublicAvatar failed", err)
  }
}

export async function updateProfileAction(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const slug = OrgSlugSchema.safeParse(orgSlug)
  const body = PatchMeRequestSchema.safeParse(input)
  if (!slug.success || !body.success) return { ok: false, error: "validation" }
  try {
    await requireMemberOrg(slug.data)
    const api = await getAuthedApiClient()
    await api.me.patch(body.data)
    revalidateMember(slug.data)
    return { ok: true }
  } catch (err) {
    console.error("updateProfileAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function updateLanguageAction(
  orgSlug: string,
  localeRaw: unknown
): Promise<ActionResult> {
  const slug = OrgSlugSchema.safeParse(orgSlug)
  if (!slug.success || typeof localeRaw !== "string" || !isLocale(localeRaw)) {
    return { ok: false, error: "validation" }
  }
  const locale: Locale = localeRaw
  try {
    await requireMemberOrg(slug.data)
    const api = await getAuthedApiClient()
    await api.me.patch({ locale })
    const [jar, hdrs] = await Promise.all([cookies(), headers()])
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host")
    jar.set(
      cookieName,
      locale,
      getLocaleCookieOptions(host, { httpOnly: false })
    )
    revalidatePath("/", "layout")
    revalidateMember(slug.data)
    return { ok: true }
  } catch (err) {
    console.error("updateLanguageAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function updateNotificationPreferencesAction(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const slug = OrgSlugSchema.safeParse(orgSlug)
  const body = PutNotificationPreferencesRequestSchema.safeParse(input)
  if (!slug.success || !body.success) return { ok: false, error: "validation" }
  try {
    await requireMemberOrg(slug.data)
    const api = await getAuthedApiClient()
    await api.me.putNotificationPreferences(body.data)
    revalidateMember(slug.data)
    return { ok: true }
  } catch (err) {
    console.error("updateNotificationPreferencesAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function updateConsentAction(
  orgSlug: string,
  input: unknown
): Promise<ActionResult> {
  const slug = OrgSlugSchema.safeParse(orgSlug)
  const body = PutMeConsentRequestSchema.safeParse(input)
  if (!slug.success || !body.success) return { ok: false, error: "validation" }
  try {
    await requireMemberOrg(slug.data)
    const api = await getAuthedApiClient()
    await api.me.putConsent(body.data)
    revalidateMember(slug.data)
    return { ok: true }
  } catch (err) {
    console.error("updateConsentAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function cancelBookingAction(
  orgSlug: string,
  bookingId: string
): Promise<ActionResult> {
  const slug = OrgSlugSchema.safeParse(orgSlug)
  const id = UuidSchema.safeParse(bookingId)
  if (!slug.success || !id.success) return { ok: false, error: "validation" }
  try {
    await requireMemberOrg(slug.data)
    const api = await getAuthedApiClient()
    await api.me.cancelBooking(id.data)
    revalidateMember(slug.data)
    return { ok: true }
  } catch (err) {
    console.error("cancelBookingAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function rescheduleBookingAction(
  orgSlug: string,
  bookingId: string,
  input: unknown
): Promise<ActionResult> {
  const slug = OrgSlugSchema.safeParse(orgSlug)
  const id = UuidSchema.safeParse(bookingId)
  const body = RescheduleMeBookingRequestSchema.safeParse(input)
  if (!slug.success || !id.success || !body.success) {
    return { ok: false, error: "validation" }
  }
  try {
    await requireMemberOrg(slug.data)
    const api = await getAuthedApiClient()
    await api.me.rescheduleBooking(id.data, body.data)
    revalidateMember(slug.data)
    return { ok: true }
  } catch (err) {
    console.error("rescheduleBookingAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function requestDsarAction(): Promise<
  ActionResult<{ id: string; status: string }>
> {
  try {
    const api = await getAuthedApiClient()
    const result = await api.privacy.requestDsar()
    return { ok: true, id: result.id, status: result.status }
  } catch (err) {
    console.error("requestDsarAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function getDsarAction(id: string): Promise<
  ActionResult<{
    id: string
    status: string
    downloadUrl?: string
  }>
> {
  const parsed = UuidSchema.safeParse(id)
  if (!parsed.success) return { ok: false, error: "validation" }
  try {
    const api = await getAuthedApiClient()
    const result = await api.privacy.getDsar(parsed.data)
    return {
      ok: true,
      id: result.id,
      status: result.status,
      downloadUrl: result.downloadUrl,
    }
  } catch (err) {
    console.error("getDsarAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function deleteAccountAction(): Promise<
  ActionResult<{ scheduledFor: string }>
> {
  try {
    const api = await getAuthedApiClient()
    const result = await api.privacy.deleteAccount()
    return { ok: true, scheduledFor: result.scheduledFor }
  } catch (err) {
    console.error("deleteAccountAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function cancelDeletionAction(): Promise<ActionResult> {
  try {
    const api = await getAuthedApiClient()
    await api.privacy.cancelDeletion()
    return { ok: true }
  } catch (err) {
    console.error("cancelDeletionAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function getAvatarUploadToken(): Promise<string> {
  const session = await requireSession()
  return mintUploadToken(session.user.id)
}

export async function updateAvatarAction(
  orgSlug: string,
  url: string
): Promise<ActionResult> {
  const slug = OrgSlugSchema.safeParse(orgSlug)
  const body = UpdateAvatarRequestSchema.safeParse({ url })
  if (!body.success) return { ok: false, error: "validation" }
  if (!slug.success) {
    await discardOrphanPublicAvatar(body.data.url)
    return { ok: false, error: "validation" }
  }
  try {
    const api = await getAuthedApiClient()
    await api.users.avatar.update(body.data)
    revalidateMember(slug.data)
    return { ok: true }
  } catch (err) {
    await discardOrphanPublicAvatar(body.data.url)
    console.error("updateAvatarAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function removeAvatarAction(
  orgSlug: string
): Promise<ActionResult> {
  const slug = OrgSlugSchema.safeParse(orgSlug)
  if (!slug.success) return { ok: false, error: "validation" }
  try {
    const api = await getAuthedApiClient()
    await api.users.avatar.remove()
    revalidateMember(slug.data)
    return { ok: true }
  } catch (err) {
    console.error("removeAvatarAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}
