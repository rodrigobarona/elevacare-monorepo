import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm"

import { readPage, type PageWindow } from "@eleva/config/pagination"

import { withOrgContext, type Tx } from "../context"
import * as auth from "../schema/auth"
import * as main from "../schema/main"

export interface PartnerApplicationLicence {
  professionalBody: string
  licenceNumber: string
  ersRegistrationNumber: string
}

/** Latest licence application for a profile (any status), newest first. */
export async function getLatestPartnerApplication(
  orgId: string,
  expertProfileId: string
): Promise<main.BecomePartnerApplication | null> {
  return withOrgContext(orgId, async (tx) => {
    const rows = await tx
      .select()
      .from(main.becomePartnerApplications)
      .where(
        and(
          eq(main.becomePartnerApplications.orgId, orgId),
          eq(main.becomePartnerApplications.expertProfileId, expertProfileId)
        )
      )
      .orderBy(desc(main.becomePartnerApplications.submittedAt))
      .limit(1)
    return rows[0] ?? null
  })
}

/**
 * File the licence for staff review. An open application (pending or
 * needs_changes) is refreshed in place back to `pending` with the new
 * licence snapshot; otherwise a new `pending` row is inserted. Locks the
 * expert profile row. Internal — call only inside an audited transaction.
 */
export async function _submitPartnerApplication(
  tx: Tx,
  input: {
    orgId: string
    expertProfileId: string
    licence: PartnerApplicationLicence
  }
): Promise<{
  application: main.BecomePartnerApplication
  refreshed: boolean
  /** The open application's licence as read under the lock, if any. */
  previous: PartnerApplicationLicence | null
}> {
  const t = main.becomePartnerApplications
  // Serialise submissions per profile, including the first one (no open row
  // to lock yet), so concurrent calls never race the open-application index.
  await tx
    .select({ id: main.expertProfiles.id })
    .from(main.expertProfiles)
    .where(eq(main.expertProfiles.id, input.expertProfileId))
    .limit(1)
    .for("update")
  const [open] = await tx
    .select({
      id: t.id,
      professionalBody: t.professionalBody,
      licenceNumber: t.licenceNumber,
      ersRegistrationNumber: t.ersRegistrationNumber,
    })
    .from(t)
    .where(
      and(
        eq(t.expertProfileId, input.expertProfileId),
        inArray(t.status, [...main.OPEN_PARTNER_APPLICATION_STATUSES])
      )
    )
    .limit(1)
    .for("update")

  const now = new Date()
  if (open) {
    const [application] = await tx
      .update(t)
      .set({
        ...input.licence,
        status: "pending",
        submittedAt: now,
        reviewerUserId: null,
        reviewedAt: null,
        reason: null,
        updatedAt: now,
      })
      .where(eq(t.id, open.id))
      .returning()
    return {
      application: application!,
      refreshed: true,
      previous: {
        professionalBody: open.professionalBody,
        licenceNumber: open.licenceNumber,
        ersRegistrationNumber: open.ersRegistrationNumber,
      },
    }
  }

  const [application] = await tx
    .insert(t)
    .values({
      orgId: input.orgId,
      expertProfileId: input.expertProfileId,
      ...input.licence,
      status: "pending",
      submittedAt: now,
    })
    .returning()
  return { application: application!, refreshed: false, previous: null }
}

/** Where a profile stands in the staff licence review. */
export type LicenceReviewState =
  | "pending"
  | "needs_changes"
  | "needs_verification"
  | "verified"
  | "rejected"
  | "not_submitted"

/**
 * `needs_verification` is the pre-cutover reconciliation state: a listed
 * profile with no open or approved application, whatever it filed before.
 */
export function licenceReviewState(
  profileStatus: main.ExpertProfile["status"],
  applicationStatus: main.PartnerApplicationStatus | null
): LicenceReviewState {
  if (applicationStatus === "pending") return "pending"
  if (applicationStatus === "needs_changes") return "needs_changes"
  if (applicationStatus === "approved") return "verified"
  if (profileStatus === "active") return "needs_verification"
  return applicationStatus === "rejected" ? "rejected" : "not_submitted"
}

export interface LicenceReviewQueueRow {
  expertProfileId: string
  displayName: string
  username: string
  profileStatus: main.ExpertProfile["status"]
  reviewState: LicenceReviewState
  professionalBody: string | null
  /** When the expert filed, or when the profile was created if they never did. */
  waitingSince: Date
}

/**
 * One page of the staff queue and how long the queue is: open applications
 * plus listed profiles with no approved application, the licences that wait
 * on staff first, oldest first, then the rest, oldest first.
 * Approved is terminal per profile, so the latest application says whether
 * one exists. Read inside the caller's transaction, so `@eleva/auth` can
 * record who read it in the same one (`listLicenceQueue`). Not for apps: a
 * read of the queue is always audited.
 */
export async function _listLicenceReviewQueue(
  tx: Tx,
  input: { page: number; pageSize: number }
): Promise<{ rows: LicenceReviewQueueRow[]; window: PageWindow }> {
  const p = main.expertProfiles
  const a = main.becomePartnerApplications
  const latest = tx
    .selectDistinctOn([a.expertProfileId], {
      expertProfileId: a.expertProfileId,
      status: a.status,
      professionalBody: a.professionalBody,
      submittedAt: a.submittedAt,
    })
    .from(a)
    .orderBy(a.expertProfileId, desc(a.submittedAt))
    .as("latest")
  const inQueue = and(
    isNull(p.deletedAt),
    or(
      inArray(latest.status, [...main.OPEN_PARTNER_APPLICATION_STATUSES]),
      and(
        eq(p.status, "active"),
        or(isNull(latest.status), ne(latest.status, "approved"))
      )
    )
  )
  // The rows and the count come from one statement: a decision made
  // between a count and a read must not empty the last page.
  const { rows, window } = await readPage({
    ...input,
    rowsFrom: (offset) =>
      tx
        .select({
          expertProfileId: p.id,
          displayName: p.displayName,
          username: p.username,
          profileStatus: p.status,
          status: latest.status,
          professionalBody: latest.professionalBody,
          submittedAt: latest.submittedAt,
          createdAt: p.createdAt,
          total: sql<number>`count(*) over ()`.mapWith(Number),
        })
        .from(p)
        .leftJoin(latest, eq(latest.expertProfileId, p.id))
        .where(inQueue)
        // What waits on staff comes first, so the top of the queue is the
        // next licence to check and nobody pages to find one. The id
        // settles two profiles with the same time, so a row is never on
        // two pages or on none.
        .orderBy(
          desc(sql`coalesce(${latest.status} = 'pending', false)`),
          asc(sql`coalesce(${latest.submittedAt}, ${p.createdAt})`),
          asc(p.id)
        )
        .limit(input.pageSize)
        .offset(offset),
  })
  return {
    window,
    rows: rows.map((row) => ({
      expertProfileId: row.expertProfileId,
      displayName: row.displayName,
      username: row.username,
      profileStatus: row.profileStatus,
      reviewState: licenceReviewState(row.profileStatus, row.status),
      professionalBody: row.professionalBody,
      waitingSince: row.submittedAt ?? row.createdAt,
    })),
  }
}

export interface LicenceReview {
  profile: main.ExpertProfile
  email: string
  reviewState: LicenceReviewState
  application: main.BecomePartnerApplication | null
}

/**
 * One profile's review: latest application plus the profile behind it.
 * Read inside the caller's transaction, so `@eleva/auth` can record who
 * opened it in the same one (`openLicenceReview`). Not for apps: a read of
 * a person's licence is always audited.
 */
export async function _readLicenceReview(
  tx: Tx,
  expertProfileId: string
): Promise<LicenceReview | null> {
  const p = main.expertProfiles
  const a = main.becomePartnerApplications
  const [row] = await tx
    .select({ profile: p, email: auth.user.email })
    .from(p)
    .innerJoin(auth.user, eq(auth.user.id, p.userId))
    .where(and(eq(p.id, expertProfileId), isNull(p.deletedAt)))
    .limit(1)
  if (!row) return null
  const [application = null] = await tx
    .select()
    .from(a)
    .where(eq(a.expertProfileId, expertProfileId))
    .orderBy(desc(a.submittedAt))
    .limit(1)
  return {
    ...row,
    application,
    reviewState: licenceReviewState(
      row.profile.status,
      application?.status ?? null
    ),
  }
}

export const PARTNER_DECISION_EVENT_TYPES = [
  "partner.approved",
  "partner.needs_changes",
  "partner.rejected",
] as const

export type PartnerDecisionEventType =
  (typeof PARTNER_DECISION_EVENT_TYPES)[number]

export type PartnerDecisionPayload = {
  applicationId: string
  expertProfileId: string
  reason: string | null
}

const SEND_NOTIFICATION_SUBSCRIBER = "send-notification"

/**
 * Queue the expert's decision email. `@eleva/auth` cannot import
 * `@eleva/workflows` (workflows -> auth), so this mirrors `emitDomainEvent`.
 * The key carries `reviewedAt` because one application can get several
 * decisions (needs_changes, refile, needs_changes). Internal — call only
 * inside the audited decision transaction.
 */
export async function _emitPartnerDecisionEvent(
  tx: Tx,
  input: PartnerDecisionPayload & {
    orgId: string
    type: PartnerDecisionEventType
    reviewedAt: Date
  }
): Promise<void> {
  const [event] = await tx
    .insert(main.domainEventsOutbox)
    .values({
      orgId: input.orgId,
      type: input.type,
      payload: {
        applicationId: input.applicationId,
        expertProfileId: input.expertProfileId,
        reason: input.reason,
      } satisfies PartnerDecisionPayload,
      idempotencyKey: `${input.type}:${input.applicationId}:${input.reviewedAt.getTime()}`,
    })
    .returning({ id: main.domainEventsOutbox.id })
  await tx.insert(main.domainEventDeliveries).values({
    orgId: input.orgId,
    eventId: event!.id,
    subscriberId: SEND_NOTIFICATION_SUBSCRIBER,
    status: "pending",
  })
}
