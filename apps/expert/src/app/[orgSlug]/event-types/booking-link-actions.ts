"use server"

import { z } from "zod"
import { requireSession } from "@eleva/auth/server"
import {
  CreateBookingLinkRequestSchema,
  type BookingLinkListItem,
  type CreateBookingLinkRequest,
} from "@eleva/api-client"
import { getAuthedApiClient } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

const IdSchema = z.string().uuid()

type ActionResult =
  | {
      ok: true
      token?: string
      urlPath?: string
      link?: BookingLinkListItem
    }
  | { ok: false; error: string; message?: string }

export async function createBookingLinkAction(
  data: CreateBookingLinkRequest
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    const parsed = CreateBookingLinkRequestSchema.safeParse(data)
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid-input",
        message: parsed.error.issues[0]?.message,
      }
    }

    const api = await getAuthedApiClient()
    const result = await api.expert.bookingLinks.create(parsed.data)

    revalidateExpertWorkspace(session, "event-types")
    return {
      ok: true,
      token: result.token,
      urlPath: result.urlPath,
      link: result.link,
    }
  } catch (err) {
    console.error("[createBookingLinkAction]", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "create-failed", {
        validation: "validation",
      }),
    }
  }
}

export async function revokeBookingLinkAction(
  linkId: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("events:manage")
    if (!IdSchema.safeParse(linkId).success) {
      return { ok: false, error: "invalid-input" }
    }

    const api = await getAuthedApiClient()
    const result = await api.expert.bookingLinks.revoke(linkId)

    revalidateExpertWorkspace(session, "event-types")
    return { ok: true, link: result.link }
  } catch (err) {
    console.error("[revokeBookingLinkAction]", err)
    return { ok: false, error: mapExpertApiError(err, "revoke-failed") }
  }
}
