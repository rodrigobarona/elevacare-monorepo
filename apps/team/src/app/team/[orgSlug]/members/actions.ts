"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import {
  ApiClientError,
  InviteTeamMemberRequestSchema,
  TeamMemberErrorSchema,
} from "@eleva/api-client"
import { resolveTeamWorkspaceBase } from "@eleva/auth/org-routing"
import {
  getWorkspaceApiClient,
  requireWorkspaceSession,
} from "@eleva/dashboard/workspace-api"

/** The refusal code the API sent, when it sent one this page knows. */
function refusal(err: unknown) {
  if (!(err instanceof ApiClientError)) return null
  const parsed = TeamMemberErrorSchema.safeParse(err.body)
  return parsed.success ? parsed.data : null
}

function revalidateMembers(orgSlug: string | null): void {
  if (orgSlug) revalidatePath(`${resolveTeamWorkspaceBase(orgSlug)}/members`)
}

export type InviteError =
  | "validation"
  | "already-member"
  | "limit"
  | "owner-required"
  | "recently-sent"
  | "failed"

export type InviteResult =
  | { ok: true; email: string; resent: boolean; emailSent: boolean }
  | { ok: false; error: InviteError }

const INVITE_ERRORS: Partial<Record<string, InviteError>> = {
  ALREADY_MEMBER: "already-member",
  MEMBER_LIMIT_REACHED: "limit",
  OWNER_REQUIRED: "owner-required",
  INVITATION_RECENTLY_SENT: "recently-sent",
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
    const known = INVITE_ERRORS[refusal(err)?.code ?? ""]
    if (known) return { ok: false, error: known }
    if (err instanceof ApiClientError && err.status === 422) {
      return { ok: false, error: "validation" }
    }
    console.error("[team] inviteMember failed", err)
    return { ok: false, error: "failed" }
  }
}

const IdSchema = z.string().uuid()

export type WithdrawResult =
  | { ok: true }
  | { ok: false; error: "gone" | "owner-required" | "failed" }

/** Withdraw a pending invitation: its link stops working. */
export async function withdrawInvitation(
  invitationId: string
): Promise<WithdrawResult> {
  const id = IdSchema.safeParse(invitationId)
  if (!id.success) return { ok: false, error: "failed" }
  try {
    const session = await requireWorkspaceSession("members:manage")
    const api = await getWorkspaceApiClient()
    try {
      await api.teams.cancelInvitation(session.orgId, id.data)
    } catch (err) {
      const code = refusal(err)?.code
      if (code === "OWNER_REQUIRED") {
        return { ok: false, error: "owner-required" }
      }
      if (code !== "INVITATION_NOT_FOUND") throw err
      // Answered or withdrawn meanwhile: refresh so the row goes away.
      revalidateMembers(session.orgSlug)
      return { ok: false, error: "gone" }
    }
    revalidateMembers(session.orgSlug)
    return { ok: true }
  } catch (err) {
    console.error("[team] withdrawInvitation failed", err)
    return { ok: false, error: "failed" }
  }
}

export type RemoveError =
  | "upcoming-sessions"
  | "owner"
  | "self"
  | "owner-required"
  | "failed"

export type RemoveResult =
  | { ok: true }
  | { ok: false; error: "gone" }
  | { ok: false; error: RemoveError; upcomingSessions?: number }

const REMOVE_ERRORS: Partial<Record<string, RemoveError>> = {
  MEMBER_HAS_UPCOMING_SESSIONS: "upcoming-sessions",
  CANNOT_REMOVE_OWNER: "owner",
  CANNOT_REMOVE_SELF: "self",
  OWNER_REQUIRED: "owner-required",
}

/** Remove someone from the clinic. */
export async function removeMember(memberId: string): Promise<RemoveResult> {
  const id = IdSchema.safeParse(memberId)
  if (!id.success) return { ok: false, error: "failed" }
  try {
    const session = await requireWorkspaceSession("members:manage")
    const api = await getWorkspaceApiClient()
    try {
      await api.teams.removeMember(session.orgId, id.data)
    } catch (err) {
      const refused = refusal(err)
      if (refused?.code === "MEMBER_NOT_FOUND") {
        // Removed meanwhile: refresh so the row goes away.
        revalidateMembers(session.orgSlug)
        return { ok: false, error: "gone" }
      }
      const known = REMOVE_ERRORS[refused?.code ?? ""]
      if (!known) throw err
      return {
        ok: false,
        error: known,
        upcomingSessions: refused?.upcomingSessions,
      }
    }
    revalidateMembers(session.orgSlug)
    return { ok: true }
  } catch (err) {
    console.error("[team] removeMember failed", err)
    return { ok: false, error: "failed" }
  }
}
