import { beforeEach, describe, expect, it, vi } from "vitest"

const { withAudit, emit, renderInvoiceClosedGate, getEmailTranslations } =
  vi.hoisted(() => {
    const emit = vi.fn().mockResolvedValue(undefined)
    return {
      emit,
      withAudit: vi.fn(
        async (
          _opts: unknown,
          fn: (tx: unknown, ctx: { emit: typeof emit }) => Promise<unknown>
        ) => fn({}, { emit })
      ),
      renderInvoiceClosedGate: vi.fn(async () => "<p>closed-gate</p>"),
      getEmailTranslations: vi.fn(() => ({
        subject: {
          invoiceBlocked: "Platform-fee invoice could not be issued yet",
          invoiceSkipped: "No platform-fee invoice for this payment",
          invoicePending: "Platform-fee invoice is waiting on tax details",
        },
      })),
    }
  })

vi.mock("@eleva/audit", () => ({ withAudit }))
vi.mock("@eleva/email", () => ({
  renderInvoiceClosedGate,
  getEmailTranslations,
}))
vi.mock("@eleva/db", () => ({
  auth: { user: {}, member: {} },
  withPlatformAdminContext: vi.fn(),
  listMemberNotificationPreferences: vi.fn(),
}))

import {
  isOrgOperator,
  sendClosedGateInvoiceNotification,
  toEmailLocale,
} from "./send-closed-gate-invoice"

const INVOICE_ID = "00000000-0000-4000-8000-000000000001"
const PAYMENT_ID = "00000000-0000-4000-8000-000000000002"
const ORG_ID = "00000000-0000-4000-8000-000000000003"
const USER_ID = "00000000-0000-4000-8000-000000000004"

const operator = {
  userId: USER_ID,
  email: "expert@example.com",
  name: "Ana",
  locale: "pt",
  role: "owner",
}

function payload(status: "blocked" | "skipped" | "pending") {
  return {
    invoiceKind: "platform_fee" as const,
    invoiceId: INVOICE_ID,
    bookingPaymentId: PAYMENT_ID,
    expertOrgId: ORG_ID,
    status,
    number: null,
    pdfUrl: null,
    error:
      status === "blocked"
        ? "toconline_v1_auto_finalize_blocked"
        : status === "skipped"
          ? "zero_fee"
          : "iva_lookup_unavailable",
  }
}

describe("sendClosedGateInvoiceNotification", () => {
  beforeEach(() => {
    withAudit.mockClear()
    emit.mockClear()
    renderInvoiceClosedGate.mockClear()
    getEmailTranslations.mockClear()
  })

  it("emails the expert org operator for blocked, skipped, and pending", async () => {
    const sendEmail = vi.fn().mockResolvedValue(undefined)
    const listPreferences = vi.fn().mockResolvedValue([
      {
        channel: "email",
        category: "payment",
        enabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        timezone: "Europe/Lisbon",
      },
    ])

    for (const status of ["blocked", "skipped", "pending"] as const) {
      sendEmail.mockClear()
      listPreferences.mockClear()
      await sendClosedGateInvoiceNotification(
        {
          id: `evt-${status}`,
          type: `invoice.${status}`,
          orgId: ORG_ID,
          payload: payload(status),
        },
        {
          listRecipients: async () => [operator],
          listPreferences,
          sendEmail,
        }
      )

      expect(listPreferences).toHaveBeenCalledWith(USER_ID)
      expect(sendEmail).toHaveBeenCalledTimes(1)
      expect(sendEmail.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          to: "expert@example.com",
          html: "<p>closed-gate</p>",
          idempotencyKey: `evt-${status}:${USER_ID}:email`,
        })
      )
      expect(renderInvoiceClosedGate).toHaveBeenCalledWith(
        expect.objectContaining({
          status,
          invoiceId: INVOICE_ID,
          error: payload(status).error,
        })
      )
    }

    expect(emit).toHaveBeenCalledTimes(3)
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "notification",
        action: "sent",
        entityId: INVOICE_ID,
        payload: expect.objectContaining({
          kind: "invoice.blocked",
          channel: "email",
          category: "payment",
          recipientCount: 1,
        }),
      })
    )
  })

  it("does not send invoice.issued or payloads that pretend a document exists", async () => {
    const sendEmail = vi.fn()
    await expect(
      sendClosedGateInvoiceNotification(
        {
          id: "evt-issued",
          type: "invoice.issued",
          orgId: ORG_ID,
          payload: { ...payload("blocked"), status: "issued" },
        },
        { listRecipients: async () => [operator], sendEmail }
      )
    ).rejects.toThrow(/unsupported event type/)

    await expect(
      sendClosedGateInvoiceNotification(
        {
          id: "evt-doc",
          type: "invoice.blocked",
          orgId: ORG_ID,
          payload: {
            ...payload("blocked"),
            number: "FT 1/1",
            pdfUrl: "https://x",
          },
        },
        { listRecipients: async () => [operator], sendEmail }
      )
    ).rejects.toThrow(/includes a document/)

    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("rejects events whose org does not match the expert org", async () => {
    const sendEmail = vi.fn()
    await expect(
      sendClosedGateInvoiceNotification(
        {
          id: "evt-mismatch",
          type: "invoice.blocked",
          orgId: "00000000-0000-4000-8000-000000000099",
          payload: payload("blocked"),
        },
        { listRecipients: async () => [operator], sendEmail }
      )
    ).rejects.toThrow(/does not match expert org/)
    expect(sendEmail).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it("fails closed when the expert org has no operator recipient", async () => {
    const sendEmail = vi.fn()
    await expect(
      sendClosedGateInvoiceNotification(
        {
          id: "evt-none",
          type: "invoice.blocked",
          orgId: ORG_ID,
          payload: payload("blocked"),
        },
        {
          listRecipients: async () => [{ ...operator, role: "member" }],
          sendEmail,
        }
      )
    ).rejects.toThrow(/no operator recipients/)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it("does not mark a send when Resend is not configured", async () => {
    const previous = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    try {
      await expect(
        sendClosedGateInvoiceNotification(
          {
            id: "evt-nokey",
            type: "invoice.blocked",
            orgId: ORG_ID,
            payload: payload("blocked"),
          },
          {
            listRecipients: async () => [operator],
            listPreferences: async () => [],
          }
        )
      ).rejects.toThrow(/RESEND_API_KEY is not configured/)
      expect(emit).not.toHaveBeenCalled()
    } finally {
      if (previous === undefined) delete process.env.RESEND_API_KEY
      else process.env.RESEND_API_KEY = previous
    }
  })
})

describe("closed-gate recipient helpers", () => {
  it("treats owner and admin as operators", () => {
    expect(isOrgOperator("owner")).toBe(true)
    expect(isOrgOperator("admin")).toBe(true)
    expect(isOrgOperator("owner,member")).toBe(true)
    expect(isOrgOperator("member")).toBe(false)
  })

  it("aliases pt-BR to pt", () => {
    expect(toEmailLocale("pt-BR")).toBe("pt")
    expect(toEmailLocale("es-ES")).toBe("es")
    expect(toEmailLocale("en")).toBe("en")
    expect(toEmailLocale(null)).toBe("en")
  })
})
