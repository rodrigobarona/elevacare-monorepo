"use server"

import { revalidatePath } from "next/cache"
import { unstable_rethrow } from "next/navigation"
import { z } from "zod"
import {
  ApiClientError,
  PutMeConsentRequestSchema,
  PutMeRecordAccessOptoutRequestSchema,
} from "@eleva/api-client"
import { getPersonalApiClient } from "@/lib/personal-api"

type Failure = {
  ok: false
  error: "healthData" | "alreadyScheduled" | "generic"
}
type Result<T = object> = ({ ok: true } & T) | Failure

const PRIVACY_PATH = "/account/privacy"

function failure(err: unknown): Failure {
  if (err instanceof ApiClientError) {
    const body = err.body as { code?: unknown; error?: unknown }
    const code = typeof body.code === "string" ? body.code : body.error
    if (code === "HEALTH_DATA_CONSENT_IN_USE") {
      return { ok: false, error: "healthData" }
    }
    if (code === "ACCOUNT_DELETION_ALREADY_SCHEDULED") {
      return { ok: false, error: "alreadyScheduled" }
    }
  }
  return { ok: false, error: "generic" }
}

export async function updateConsent(input: unknown): Promise<Result> {
  const parsed = PutMeConsentRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "generic" }
  try {
    const api = await getPersonalApiClient()
    await api.me.putConsent(parsed.data)
    revalidatePath(PRIVACY_PATH)
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("updateConsent failed", err)
    return failure(err)
  }
}

export async function updateRecordAccess(input: unknown): Promise<Result> {
  const parsed = PutMeRecordAccessOptoutRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "generic" }
  try {
    const api = await getPersonalApiClient()
    await api.me.putRecordAccessOptout(parsed.data)
    revalidatePath(PRIVACY_PATH)
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("updateRecordAccess failed", err)
    return failure(err)
  }
}

export async function requestDataCopy(): Promise<
  Result<{ id: string; status: string }>
> {
  try {
    const api = await getPersonalApiClient()
    const result = await api.privacy.requestDsar()
    return { ok: true, id: result.id, status: result.status }
  } catch (err) {
    unstable_rethrow(err)
    console.error("requestDataCopy failed", err)
    return failure(err)
  }
}

export async function getDataCopy(
  id: unknown
): Promise<Result<{ status: string; downloadUrl?: string }>> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: "generic" }
  try {
    const api = await getPersonalApiClient()
    const result = await api.privacy.getDsar(parsed.data)
    return { ok: true, status: result.status, downloadUrl: result.downloadUrl }
  } catch (err) {
    unstable_rethrow(err)
    console.error("getDataCopy failed", err)
    return failure(err)
  }
}

export async function scheduleDeletion(): Promise<
  Result<{ scheduledFor: string }>
> {
  try {
    const api = await getPersonalApiClient()
    const result = await api.privacy.deleteAccount()
    revalidatePath(PRIVACY_PATH)
    return { ok: true, scheduledFor: result.scheduledFor }
  } catch (err) {
    unstable_rethrow(err)
    console.error("scheduleDeletion failed", err)
    return failure(err)
  }
}

export async function cancelDeletion(): Promise<Result> {
  try {
    const api = await getPersonalApiClient()
    await api.privacy.cancelDeletion()
    revalidatePath(PRIVACY_PATH)
    return { ok: true }
  } catch (err) {
    unstable_rethrow(err)
    console.error("cancelDeletion failed", err)
    return failure(err)
  }
}
