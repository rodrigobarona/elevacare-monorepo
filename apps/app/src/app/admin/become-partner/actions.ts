"use server"

import { revalidatePath } from "next/cache"
import { requireSession } from "@eleva/auth/server"
import {
  claimApplication,
  rejectApplication,
  approveApplication,
  updateExpertProfile,
  type ApproveApplicationResult,
} from "@eleva/db"
import { createConnectAccount } from "@eleva/billing/server"

type ActionResult =
  | { ok: true; data?: ApproveApplicationResult }
  | { ok: false; error: string }

export async function claimApplicationAction(
  id: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("applications:claim")
    await claimApplication(id, session.user.id)
    revalidatePath("/admin/become-partner")
    return { ok: true }
  } catch (err) {
    console.error("[admin] claimApplication failed", err)
    return { ok: false, error: "claim-failed" }
  }
}

export async function rejectApplicationAction(
  id: string,
  reason: string
): Promise<ActionResult> {
  try {
    if (!reason.trim()) {
      return { ok: false, error: "reason-required" }
    }
    const session = await requireSession("applications:review")
    await rejectApplication(id, session.user.id, reason.trim())
    revalidatePath("/admin/become-partner")
    return { ok: true }
  } catch (err) {
    console.error("[admin] rejectApplication failed", err)
    return { ok: false, error: "reject-failed" }
  }
}

export async function approveApplicationAction(
  id: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("experts:approve")
    const result = await approveApplication(id, session.user.id)

    try {
      const connectAccount = await createConnectAccount(
        {
          expertProfileId: result.expertProfileId,
          orgId: result.orgId,
          email: session.user.email,
        },
        { idempotencyKey: `connect_${result.expertProfileId}` }
      )
      await updateExpertProfile(result.expertProfileId, result.orgId, {
        stripeAccountId: connectAccount.id,
      })
    } catch (stripeErr) {
      console.error(
        "[admin] Stripe Connect creation failed (approval persisted)",
        stripeErr
      )
    }

    revalidatePath("/admin/become-partner")
    return { ok: true, data: result }
  } catch (err) {
    console.error("[admin] approveApplication failed", err)
    return { ok: false, error: "approve-failed" }
  }
}
