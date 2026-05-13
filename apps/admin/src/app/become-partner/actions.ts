"use server"

import { revalidatePath } from "next/cache"
import { requireSession, getWorkOS } from "@eleva/auth/server"
import {
  claimApplication,
  rejectApplication,
  approveApplication,
  updateExpertProfile,
  type ApproveApplicationResult,
} from "@eleva/db"
import { createConnectAccount } from "@eleva/billing/server"

type ActionResult =
  | { ok: true; data?: ApproveApplicationResult; warning?: string }
  | { ok: false; error: string }

export async function claimApplicationAction(
  id: string
): Promise<ActionResult> {
  try {
    const session = await requireSession("applications:claim")
    await claimApplication(id, session.user.id)
    revalidatePath("/become-partner")
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
    const session = await requireSession("applications:review")
    if (!reason.trim()) {
      return { ok: false, error: "reason-required" }
    }
    await rejectApplication(id, session.user.id, reason.trim())
    revalidatePath("/become-partner")
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

    if (!result.applicantWorkosUserId) {
      revalidatePath("/become-partner")
      return {
        ok: true,
        data: result,
        warning:
          "Stripe Connect provisioning skipped: applicant has no WorkOS user ID.",
      }
    }

    const workosUser = await getWorkOS().userManagement.getUser(
      result.applicantWorkosUserId
    )

    try {
      const connectAccount = await createConnectAccount(
        {
          expertProfileId: result.expertProfileId,
          orgId: result.orgId,
          email: workosUser.email,
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
      revalidatePath("/become-partner")
      return {
        ok: true,
        data: result,
        warning: "stripe_connect_provision_failed",
      }
    }

    revalidatePath("/become-partner")
    return { ok: true, data: result }
  } catch (err) {
    console.error("[admin] approveApplication failed", err)
    return { ok: false, error: "approve-failed" }
  }
}
