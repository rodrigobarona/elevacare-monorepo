import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { resolveGatewayUrl } from "@eleva/config/env"
import { teamWorkspaceBase } from "@eleva/config/routing"
import {
  auth,
  CLINIC_DECISION_EVENT_TYPES,
  main,
  withPlatformAdminContext,
  type ClinicDecisionEventType,
} from "@eleva/db"
import {
  clinicDecisionCopy,
  emailSafeName,
  getEmailTranslations,
  renderClinicDecision,
} from "@eleva/email"
import { sendNotification } from "./send-notification"
import { isOrgOperator, toEmailLocale } from "./send-closed-gate-invoice"

const CLINIC_DECISION_TYPES = new Set<string>(CLINIC_DECISION_EVENT_TYPES)

const PayloadSchema = z.object({
  verificationId: z.string().uuid(),
  reason: z.string().nullable(),
  verified: z.boolean(),
})

export type ClinicDecisionEvent = {
  id: string
  type: string
  orgId: string
  payload: Record<string, unknown>
}

export type ClinicToNotify = {
  orgSlug: string
  clinicName: string
  /** The owner and the admins: the people who can act on the decision. */
  managers: { userId: string; name: string; locale: string | null }[]
}

type SendDeps = {
  loadClinic?: (orgId: string) => Promise<ClinicToNotify | null>
  send?: typeof sendNotification
}

export function isClinicDecisionKind(
  type: string
): type is ClinicDecisionEventType {
  return CLINIC_DECISION_TYPES.has(type)
}

/**
 * Tells a clinic's owner and admins what staff decided about its legal
 * identity: an email and an inbox notice each, in their own language, with
 * what staff found and a link to the clinic's Verification page.
 */
export async function sendClinicDecisionNotification(
  event: ClinicDecisionEvent,
  deps: SendDeps = {}
): Promise<void> {
  if (!isClinicDecisionKind(event.type)) {
    throw new Error(`send-notification: unsupported event type ${event.type}`)
  }
  const kind = event.type
  const parsed = PayloadSchema.safeParse(event.payload)
  if (!parsed.success) {
    throw new Error("send-notification: clinic payload is invalid")
  }
  const clinic = await (deps.loadClinic ?? loadClinic)(event.orgId)
  if (!clinic) {
    throw new Error("send-notification: clinic not found for event org")
  }
  // The whole address, for the email and for the inbox: a notice is read
  // from any workspace (Space, a practice, the clinic), and a link into
  // another one has to leave the page it is on.
  const verificationHref = `${resolveGatewayUrl()}${teamWorkspaceBase(clinic.orgSlug)}/verification`
  const send = deps.send ?? sendNotification
  if (clinic.managers.length === 0) {
    // Nobody to tell: worth knowing, never worth a retry.
    console.warn(
      "[notifications] clinic decision has no owner or admin to tell",
      { orgId: event.orgId, eventId: event.id }
    )
    return
  }

  // Each person is told on their own: one address that fails never keeps
  // the notice from the others. A retry skips those already told.
  const results = await Promise.allSettled(
    clinic.managers.map(async (manager) => {
      const locale = toEmailLocale(manager.locale)
      const copy = clinicDecisionCopy(
        getEmailTranslations(locale),
        kind,
        parsed.data.verified
      )
      const html = await renderClinicDecision({
        kind: kind,
        verificationHref,
        clinicName: clinic.clinicName,
        reason: parsed.data.reason,
        verified: parsed.data.verified,
        name: manager.name.trim().split(/\s+/)[0],
        locale,
      })
      // Someone who manages two clinics sees which one this is about.
      const clinicName = emailSafeName(clinic.clinicName)
      await send({
        kind: kind,
        orgId: event.orgId,
        recipient: { userId: manager.userId },
        ctx: {
          title: copy.title,
          body: clinicName ? `${clinicName}: ${copy.subtitle}` : copy.subtitle,
          subject: copy.subject,
          html,
          href: verificationHref,
        },
        // One notice per person; a retry of the event never sends it twice.
        idempotencyKey: `clinic:${event.id}:${manager.userId}`,
      })
    })
  )
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  )
  if (failures.length > 0) {
    // Why, for whoever reads a failed delivery: the message is all the
    // publisher keeps.
    const reasons = failures
      .map((failure) =>
        failure.reason instanceof Error
          ? failure.reason.message
          : String(failure.reason)
      )
      .join("; ")
      .slice(0, 400)
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `clinic decision notification delivery failed for ${failures.length} of ${results.length}: ${reasons}`
    )
  }
}

async function loadClinic(orgId: string): Promise<ClinicToNotify | null> {
  return withPlatformAdminContext(async (tx) => {
    const [org] = await tx
      .select({
        slug: auth.organization.slug,
        name: auth.organization.name,
        clinicName: main.clinicProfiles.displayName,
      })
      .from(auth.organization)
      .leftJoin(
        main.clinicProfiles,
        eq(main.clinicProfiles.orgId, auth.organization.id)
      )
      .where(
        and(eq(auth.organization.id, orgId), eq(auth.organization.type, "team"))
      )
      .limit(1)
    if (!org) return null
    const members = await tx
      .select({
        userId: auth.member.userId,
        role: auth.member.role,
        name: auth.user.name,
        locale: auth.user.locale,
      })
      .from(auth.member)
      .innerJoin(auth.user, eq(auth.user.id, auth.member.userId))
      .where(eq(auth.member.organizationId, orgId))
      .orderBy(auth.member.createdAt, auth.member.userId)
    return {
      orgSlug: org.slug,
      clinicName: org.clinicName ?? org.name,
      managers: members
        .filter((member) => isOrgOperator(member.role))
        .map(({ userId, name, locale }) => ({ userId, name, locale })),
    }
  })
}
