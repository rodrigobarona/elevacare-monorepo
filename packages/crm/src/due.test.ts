import { describe, expect, it, vi } from "vitest"
import type { SendNotificationResult } from "@eleva/notifications"
import {
  dueDigestIdempotencyKey,
  groupDueFollowUps,
  notifyDueFollowUps,
  type DueFollowUpRow,
} from "./due"

const NOW = new Date("2026-10-20T12:00:00.000Z")

function row(overrides: Partial<DueFollowUpRow> = {}): DueFollowUpRow {
  return {
    id: "fu-1",
    orgId: "org-1",
    orgSlug: "fisiomota",
    authorId: "expert-1",
    authorLocale: "en",
    ...overrides,
  }
}

function sent(): SendNotificationResult {
  return {
    kind: "crm.follow_up_due",
    deliveries: [{ channel: "in_app", deliveryId: "d-1", status: "sent" }],
  }
}

describe("groupDueFollowUps", () => {
  it("groups by org and author and keeps due order", () => {
    expect(
      groupDueFollowUps([
        row({ id: "a1" }),
        row({ id: "b1", authorId: "expert-2" }),
        row({ id: "a2" }),
      ])
    ).toEqual([
      {
        orgId: "org-1",
        orgSlug: "fisiomota",
        authorId: "expert-1",
        authorLocale: "en",
        followUpIds: ["a1", "a2"],
      },
      {
        orgId: "org-1",
        orgSlug: "fisiomota",
        authorId: "expert-2",
        authorLocale: "en",
        followUpIds: ["b1"],
      },
    ])
  })
})

describe("dueDigestIdempotencyKey", () => {
  it("is stable for the same set regardless of id order", () => {
    const digest = {
      orgId: "org-1",
      orgSlug: "fisiomota",
      authorId: "expert-1",
      authorLocale: "en",
      followUpIds: ["b", "a"],
    }
    expect(dueDigestIdempotencyKey(digest)).toBe(
      dueDigestIdempotencyKey({ ...digest, followUpIds: ["a", "b"] })
    )
  })
})

describe("notifyDueFollowUps", () => {
  it("sends one in-app digest per author and stamps notified_at", async () => {
    const send = vi.fn().mockResolvedValue(sent())
    const markNotified = vi.fn().mockResolvedValue(undefined)

    const result = await notifyDueFollowUps(
      { now: NOW },
      {
        listDue: async () => [
          row({ id: "a1" }),
          row({ id: "a2" }),
          row({ id: "b1", authorId: "expert-2", authorLocale: "pt" }),
        ],
        send,
        markNotified,
      }
    )

    expect(result).toEqual({ scanned: 3, notified: 3, errors: 0 })
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      kind: "crm.follow_up_due",
      orgId: "org-1",
      recipient: { userId: "expert-1" },
      ctx: {
        title: "Follow-ups due",
        body: "2 member follow-ups are due. Open Relationships to review them.",
        href: "/fisiomota/team/crm",
        data: { count: 2 },
      },
    })
    expect(send.mock.calls[1]?.[0].ctx.body).toBe(
      "Tem 1 acompanhamento de membro pendente. Abra Relações para o rever."
    )
    expect(markNotified).toHaveBeenCalledWith({
      ids: ["a1", "a2"],
      now: NOW,
    })
    expect(markNotified).toHaveBeenCalledWith({
      ids: ["b1"],
      now: NOW,
    })
  })

  it("does not stamp notified_at when the digest is not delivered", async () => {
    const markNotified = vi.fn()
    const markAttempted = vi.fn().mockResolvedValue(undefined)
    const result = await notifyDueFollowUps(
      { now: NOW },
      {
        listDue: async () => [row()],
        send: async () => ({
          kind: "crm.follow_up_due",
          deliveries: [
            { channel: "in_app", deliveryId: "d-1", status: "failed" },
          ],
        }),
        markNotified,
        markAttempted,
      }
    )
    expect(result).toEqual({ scanned: 1, notified: 0, errors: 1 })
    expect(markNotified).not.toHaveBeenCalled()
    expect(markAttempted).toHaveBeenCalledWith({ ids: ["fu-1"] })
  })

  it("treats a preference-disabled empty delivery list as terminal", async () => {
    const markNotified = vi.fn().mockResolvedValue(undefined)
    const markAttempted = vi.fn()
    const result = await notifyDueFollowUps(
      { now: NOW },
      {
        listDue: async () => [row()],
        send: async () => ({
          kind: "crm.follow_up_due",
          deliveries: [],
        }),
        markNotified,
        markAttempted,
      }
    )
    expect(result).toEqual({ scanned: 1, notified: 1, errors: 0 })
    expect(markNotified).toHaveBeenCalledWith({ ids: ["fu-1"], now: NOW })
    expect(markAttempted).not.toHaveBeenCalled()
  })

  it("does not stamp notified_at when the in-app delivery is held", async () => {
    const markNotified = vi.fn()
    const markAttempted = vi.fn().mockResolvedValue(undefined)
    const result = await notifyDueFollowUps(
      { now: NOW },
      {
        listDue: async () => [row()],
        send: async () => ({
          kind: "crm.follow_up_due",
          deliveries: [
            { channel: "in_app", deliveryId: "d-1", status: "held" },
          ],
        }),
        markNotified,
        markAttempted,
      }
    )
    expect(result).toEqual({ scanned: 1, notified: 0, errors: 1 })
    expect(markNotified).not.toHaveBeenCalled()
    expect(markAttempted).not.toHaveBeenCalled()
  })

  it("continues other authors when one digest throws", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(sent())
    const markNotified = vi.fn().mockResolvedValue(undefined)
    const markAttempted = vi.fn().mockResolvedValue(undefined)

    const result = await notifyDueFollowUps(
      { now: NOW },
      {
        listDue: async () => [
          row({ id: "a1" }),
          row({ id: "b1", authorId: "expert-2" }),
        ],
        send,
        markNotified,
        markAttempted,
      }
    )

    expect(result).toEqual({ scanned: 2, notified: 1, errors: 1 })
    expect(markNotified).toHaveBeenCalledTimes(1)
    expect(markNotified).toHaveBeenCalledWith({ ids: ["b1"], now: NOW })
    expect(markAttempted).toHaveBeenCalledWith({ ids: ["a1"] })
  })

  it("continues other authors when recording an attempt throws", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(sent())
    const markNotified = vi.fn().mockResolvedValue(undefined)
    const markAttempted = vi.fn().mockRejectedValueOnce(new Error("stamp"))

    const result = await notifyDueFollowUps(
      { now: NOW },
      {
        listDue: async () => [
          row({ id: "a1" }),
          row({ id: "b1", authorId: "expert-2" }),
        ],
        send,
        markNotified,
        markAttempted,
      }
    )

    expect(result).toEqual({ scanned: 2, notified: 1, errors: 1 })
    expect(markNotified).toHaveBeenCalledWith({ ids: ["b1"], now: NOW })
  })
})
