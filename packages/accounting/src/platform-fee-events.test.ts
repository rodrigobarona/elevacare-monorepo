import { describe, expect, it, vi } from "vitest"
import {
  CLOSED_GATE_INVOICE_EVENT_TYPES,
  CLOSED_GATE_INVOICE_SUBSCRIBERS,
  closedGateInvoiceEventType,
  closedGateInvoiceIdempotencyKey,
  closedGateInvoicePayload,
  emitClosedGateInvoiceDomainEvent,
} from "./platform-fee-events"

const INVOICE_ID = "00000000-0000-4000-8000-000000000001"
const PAYMENT_ID = "00000000-0000-4000-8000-000000000002"
const ORG_ID = "00000000-0000-4000-8000-000000000003"

describe("closed-gate invoice event contract", () => {
  it("maps persisted statuses without inventing issued or failed", () => {
    expect(closedGateInvoiceEventType("blocked")).toBe("invoice.blocked")
    expect(closedGateInvoiceEventType("skipped")).toBe("invoice.skipped")
    expect(closedGateInvoiceEventType("pending")).toBe("invoice.pending")
    expect(CLOSED_GATE_INVOICE_EVENT_TYPES).not.toContain("invoice.issued")
    expect(CLOSED_GATE_INVOICE_EVENT_TYPES).not.toContain("invoice.failed")
    expect(CLOSED_GATE_INVOICE_EVENT_TYPES).not.toContain("invoice.credited")
  })

  it("keys the outbox by invoice id and closed-gate status", () => {
    expect(closedGateInvoiceIdempotencyKey(INVOICE_ID, "blocked")).toBe(
      `invoice:platform_fee:${INVOICE_ID}:blocked`
    )
  })

  it("never pretends a document number or PDF exists", () => {
    const payload = closedGateInvoicePayload({
      invoiceId: INVOICE_ID,
      bookingPaymentId: PAYMENT_ID,
      expertOrgId: ORG_ID,
      status: "blocked",
      error: "toconline_v1_auto_finalize_blocked",
    })
    expect(payload).toEqual({
      invoiceKind: "platform_fee",
      invoiceId: INVOICE_ID,
      bookingPaymentId: PAYMENT_ID,
      expertOrgId: ORG_ID,
      status: "blocked",
      number: null,
      pdfUrl: null,
      error: "toconline_v1_auto_finalize_blocked",
    })
  })

  it("registers send-notification as the closed-gate subscriber", () => {
    expect(CLOSED_GATE_INVOICE_SUBSCRIBERS).toEqual(["send-notification"])
  })
})

describe("emitClosedGateInvoiceDomainEvent", () => {
  it("inserts one outbox row and a send-notification delivery", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const deliveryInsert = vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    })
    const tx = {
      insert: vi
        .fn()
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "evt-1" }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue(deliveryInsert()),
        }),
    }

    const ref = await emitClosedGateInvoiceDomainEvent(tx as never, {
      orgId: ORG_ID,
      invoiceId: INVOICE_ID,
      bookingPaymentId: PAYMENT_ID,
      expertOrgId: ORG_ID,
      status: "skipped",
      error: "zero_fee",
    })

    expect(ref).toEqual({
      type: "invoice.skipped",
      idempotencyKey: `invoice:platform_fee:${INVOICE_ID}:skipped`,
    })
    expect(tx.insert).toHaveBeenCalledTimes(2)
    expect(info).toHaveBeenCalledWith("[domain-events] closed-gate invoice", {
      eventId: "evt-1",
      type: "invoice.skipped",
      orgId: ORG_ID,
      invoiceId: INVOICE_ID,
      status: "skipped",
    })
    info.mockRestore()
  })

  it("reuses the existing outbox row on idempotency conflict", async () => {
    const tx = {
      insert: vi
        .fn()
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]),
            }),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "evt-existing" }]),
          }),
        }),
      }),
    }

    const ref = await emitClosedGateInvoiceDomainEvent(tx as never, {
      orgId: ORG_ID,
      invoiceId: INVOICE_ID,
      bookingPaymentId: PAYMENT_ID,
      expertOrgId: ORG_ID,
      status: "pending",
      error: "iva_lookup_unavailable",
    })

    expect(ref.type).toBe("invoice.pending")
    expect(tx.select).toHaveBeenCalledTimes(1)
  })
})
