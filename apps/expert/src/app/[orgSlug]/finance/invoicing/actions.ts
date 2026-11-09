"use server"

import { getAuthedApiClient, requireExpertSession } from "@/lib/server-api"
import { mapExpertApiError } from "@/lib/map-api-error"
import { revalidateExpertWorkspace } from "@/lib/revalidate-workspace"

type ActionResult = { ok: true } | { ok: false; error: string }

export async function disconnectInvoicing(): Promise<ActionResult> {
  try {
    const session = await requireExpertSession("expert:invoicing_manage")
    const api = await getAuthedApiClient()
    await api.accounting.disconnect()
    revalidateExpertWorkspace(session, "finance/invoicing")
    return { ok: true }
  } catch (err) {
    console.error("[finance/invoicing] disconnect failed", err)
    return { ok: false, error: mapExpertApiError(err, "disconnect-failed") }
  }
}
