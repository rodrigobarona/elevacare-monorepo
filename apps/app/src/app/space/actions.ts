"use server"

import { cookies, headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  ApiClientError,
  type CancellationQuote,
  PatchMeRequestSchema,
  PutMeConsentRequestSchema,
  PutMeRecordAccessOptoutRequestSchema,
  PutNotificationPreferencesRequestSchema,
  RescheduleMeBookingRequestSchema,
  UpdateAvatarRequestSchema,
} from "@eleva/api-client"
import { requireSession } from "@eleva/auth/server"
import { mintUploadToken } from "@eleva/auth/upload-token"
import { isAvatarUrl } from "@eleva/config/avatar-upload"
import { spacePath } from "@eleva/config/routing"
import { deletePublicObject } from "@eleva/storage"
import {
  cookieName,
  getLocaleCookieOptions,
  isLocale,
  type Locale,
} from "@eleva/config/i18n"
import { getAuthedApiClient, requireMemberSpace } from "@/lib/member-api"

export type ActionResult<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : ({ ok: true } & T) | { ok: false; error: string }

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

function revalidateMember() {
  revalidatePath(spacePath())
  revalidatePath(spacePath("sessions"))
  revalidatePath(spacePath("payments"))
  revalidatePath(spacePath("settings"))
  revalidatePath(spacePath("privacy"))
}

async function discardOrphanPublicAvatar(url: string): Promise<void> {
  try {
    const session = await requireSession()
    if (isAvatarUrl(url, session.user.id)) await deletePublicObject(url)
  } catch (err) {
    console.warn("discardOrphanPublicAvatar failed", err)
  }
}

export async function updateProfileAction(
  input: unknown
): Promise<ActionResult> {
  const body = PatchMeRequestSchema.safeParse(input)
  if (!body.success) return { ok: false, error: "validation" }
  try {
    await requireMemberSpace()
    const api = await getAuthedApiClient()
    await api.me.patch(body.data)
    revalidateMember()
    return { ok: true }
  } catch (err) {
    console.error("updateProfileAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function updateLanguageAction(
  localeRaw: unknown
): Promise<ActionResult> {
  if (typeof localeRaw !== "string" || !isLocale(localeRaw)) {
    return { ok: false, error: "validation" }
  }
  const locale: Locale = localeRaw
  try {
    await requireMemberSpace()
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
    revalidateMember()
    return { ok: true }
  } catch (err) {
    console.error("updateLanguageAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function updateNotificationPreferencesAction(
  input: unknown
): Promise<ActionResult> {
  const body = PutNotificationPreferencesRequestSchema.safeParse(input)
  if (!body.success) return { ok: false, error: "validation" }
  try {
    await requireMemberSpace()
    const api = await getAuthedApiClient()
    await api.me.putNotificationPreferences(body.data)
    revalidateMember()
    return { ok: true }
  } catch (err) {
    console.error("updateNotificationPreferencesAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function updateRecordAccessOptoutAction(
  input: unknown
): Promise<ActionResult> {
  const body = PutMeRecordAccessOptoutRequestSchema.safeParse(input)
  if (!body.success) return { ok: false, error: "validation" }
  try {
    await requireMemberSpace()
    const api = await getAuthedApiClient()
    await api.me.putRecordAccessOptout(body.data)
    revalidateMember()
    return { ok: true }
  } catch (err) {
    console.error("updateRecordAccessOptoutAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function updateConsentAction(
  input: unknown
): Promise<ActionResult> {
  const body = PutMeConsentRequestSchema.safeParse(input)
  if (!body.success) return { ok: false, error: "validation" }
  try {
    await requireMemberSpace()
    const api = await getAuthedApiClient()
    await api.me.putConsent(body.data)
    revalidateMember()
    return { ok: true }
  } catch (err) {
    console.error("updateConsentAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function getCancellationQuoteAction(
  bookingId: string
): Promise<ActionResult<{ quote: CancellationQuote | null }>> {
  const id = UuidSchema.safeParse(bookingId)
  if (!id.success) return { ok: false, error: "validation" }
  try {
    await requireMemberSpace()
    const api = await getAuthedApiClient()
    const quote = await api.me.cancellationQuote(id.data)
    return { ok: true, quote }
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 409) {
      return { ok: true, quote: null }
    }
    console.error("getCancellationQuoteAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function cancelBookingAction(
  bookingId: string
): Promise<ActionResult<{ refund: CancellationQuote }>> {
  const id = UuidSchema.safeParse(bookingId)
  if (!id.success) return { ok: false, error: "validation" }
  try {
    await requireMemberSpace()
    const api = await getAuthedApiClient()
    const { refund } = await api.me.cancelBooking(id.data)
    revalidateMember()
    return { ok: true, refund }
  } catch (err) {
    console.error("cancelBookingAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function rescheduleBookingAction(
  bookingId: string,
  input: unknown
): Promise<ActionResult> {
  const id = UuidSchema.safeParse(bookingId)
  const body = RescheduleMeBookingRequestSchema.safeParse(input)
  if (!id.success || !body.success) {
    return { ok: false, error: "validation" }
  }
  try {
    await requireMemberSpace()
    const api = await getAuthedApiClient()
    await api.me.rescheduleBooking(id.data, body.data)
    revalidateMember()
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

export async function updateAvatarAction(url: string): Promise<ActionResult> {
  const body = UpdateAvatarRequestSchema.safeParse({ url })
  if (!body.success) return { ok: false, error: "validation" }
  try {
    const api = await getAuthedApiClient()
    await api.users.avatar.update(body.data)
    revalidateMember()
    return { ok: true }
  } catch (err) {
    await discardOrphanPublicAvatar(body.data.url)
    console.error("updateAvatarAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}

export async function removeAvatarAction(): Promise<ActionResult> {
  try {
    const api = await getAuthedApiClient()
    await api.users.avatar.remove()
    revalidateMember()
    return { ok: true }
  } catch (err) {
    console.error("removeAvatarAction failed", err)
    return { ok: false, error: mapGenericError(err) }
  }
}
