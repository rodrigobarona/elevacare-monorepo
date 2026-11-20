"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  ApiClientError,
  InviteTeamMemberRequestSchema,
} from "@eleva/api-client"
import { resolveTeamWorkspaceBase } from "@eleva/auth/org-routing"
import {
  getWorkspaceApiClient,
  requireWorkspaceSession,
} from "@eleva/dashboard/workspace-api"

export type InviteError = "validation" | "already-member" | "limit" | "failed"

export type InviteResult =
  | { ok: true; email: string; resent: boolean; emailSent: boolean }
  | { ok: false; error: InviteError }

function revalidateMembers(orgSlug: string | null): void {
  if (orgSlug) revalidatePath(`${resolveTeamWorkspaceBase(orgSlug)}/members`)
}

/** Invite by email, or send a pending invitation again. */
export async function inviteMember(input: {
  email: string
  role: string
}): Promise<InviteResult> {
  const parsed = InviteTeamMemberRequestSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "validation" }
  try {
    const session = await requireWorkspaceSession("members:manage")
    const api = await getWorkspaceApiClient()
    const result = await api.teams.invite(session.orgId, parsed.data)
    revalidateMembers(session.orgSlug)
    return {
      ok: true,
      email: result.invitation.email,
      resent: result.resent,
      emailSent: result.emailSent,
    }
  } catch (err) {
    if (err instanceof ApiClientError) {
      if (err.body.error === "ALREADY_MEMBER") {
        return { ok: false, error: "already-member" }
      }
      if (err.body.error === "MEMBER_LIMIT_REACHED") {
        return { ok: false, error: "limit" }
      }
      if (err.status === 422) return { ok: false, error: "validation" }
    }
    console.error("[team] inviteMember failed", err)
    return { ok: false, error: "failed" }
  }
}

const IdSchema = z.string().uuid()

export type WithdrawResult =
  | { ok: true }
  | { ok: false; error: "gone" | "failed" }

/** Withdraw a pending invitation: its link stops working. */
export async function withdrawInvitation(
  invitationId: string
): Promise<WithdrawResult> {
  const id = IdSchema.safeParse(invitationId)
  if (!id.success) return { ok: false, error: "failed" }
  try {
    const session = await requireWorkspaceSession("members:manage")
    const api = await getWorkspaceApiClient()
    await api.teams.cancelInvitation(session.orgId, id.data)
    revalidateMembers(session.orgSlug)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 404) {
      // Answered or withdrawn meanwhile: refresh so the row goes away.
      const session = await requireWorkspaceSession("members:manage")
      revalidateMembers(session.orgSlug)
      return { ok: false, error: "gone" }
    }
    console.error("[team] withdrawInvitation failed", err)
    return { ok: false, error: "failed" }
  }
}

export type RemoveError =
  | "upcoming-sessions"
  | "owner"
  | "self"
  | "gone"
  | "failed"

export type RemoveResult =
  | { ok: true; unpublishedServices: number }
  | { ok: false; error: RemoveError; upcomingSessions?: number }

/** Remove someone from the clinic. */
export async function removeMember(memberId: string): Promise<RemoveResult> {
  const id = IdSchema.safeParse(memberId)
  if (!id.success) return { ok: false, error: "failed" }
  try {
    const session = await requireWorkspaceSession("members:manage")
    const api = await getWorkspaceApiClient()
    const removed = await api.teams.removeMember(session.orgId, id.data)
    revalidateMembers(session.orgSlug)
    return { ok: true, unpublishedServices: removed.unpublishedServices }
  } catch (err) {
    if (err instanceof ApiClientError) {
      const body = err.body as { error: string; upcomingSessions?: unknown }
      if (body.error === "MEMBER_HAS_UPCOMING_SESSIONS") {
        return {
          ok: false,
          error: "upcoming-sessions",
          upcomingSessions:
            typeof body.upcomingSessions === "number"
              ? body.upcomingSessions
              : undefined,
        }
      }
      if (body.error === "CANNOT_REMOVE_OWNER") {
        return { ok: false, error: "owner" }
      }
      if (body.error === "CANNOT_REMOVE_SELF") {
        return { ok: false, error: "self" }
      }
      if (err.status === 404) return { ok: false, error: "gone" }
    }
    console.error("[team] removeMember failed", err)
    return { ok: false, error: "failed" }
  }
}
