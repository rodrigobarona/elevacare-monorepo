"use server"

import {
  EditorAssistRequestSchema,
  type EditorAssistCommand,
} from "@eleva/api-client"
import { requireSession } from "@eleva/auth/server"
import { getAuthedApiClient } from "@/lib/server-api"
import { humanApiMessage, mapExpertApiError } from "@/lib/map-api-error"

export type EditorAssistActionResult =
  | { ok: true; text: string }
  | { ok: false; error: string; message?: string }

/**
 * Thin proxy for `POST /ai/editor` — consumes the text stream into a string
 * for the event-type description assist buttons (LocalizedText until Plate
 * description storage lands).
 */
export async function editorAssistAction(input: {
  command: EditorAssistCommand
  text: string
  sourceLocale?: "en" | "pt" | "es"
  targetLocale?: "en" | "pt" | "es"
  resource: "event_type" | "expert_profile" | "location"
  resourceId: string
}): Promise<EditorAssistActionResult> {
  try {
    await requireSession("events:manage")
    const parsed = EditorAssistRequestSchema.safeParse({
      ...input,
      context: "marketing",
    })
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid-input",
        message: parsed.error.issues[0]?.message,
      }
    }

    const api = await getAuthedApiClient()
    const response = await api.ai.editorAssist(parsed.data)
    const text = (await response.text()).trim()
    if (!text) {
      return {
        ok: false,
        error: "empty",
        message: "AI assist returned no text",
      }
    }
    return { ok: true, text }
  } catch (err) {
    console.error("[editorAssistAction]", err)
    return {
      ok: false,
      error: mapExpertApiError(err, "assist-failed", {
        validation: "validation",
        forbidden: "forbidden",
      }),
      message: humanApiMessage(err),
    }
  }
}
