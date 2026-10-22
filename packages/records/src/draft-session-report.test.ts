import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAssignedExpert: vi.fn(),
  listSessionRecords: vi.fn(),
  hasActiveAiProcessingConsent: vi.fn(),
  withPlatformAdminContext: vi.fn(),
  withAudit: vi.fn(),
  decryptRecordFields: vi.fn(),
  encryptRecordFields: vi.fn(),
  generateSessionReportDraft: vi.fn(),
  emit: vi.fn(),
}))

vi.mock("@eleva/ai", () => {
  class AiModelNotApprovedError extends Error {}
  class AiModelZeroRetentionRequiredError extends Error {}
  return {
    AiModelNotApprovedError,
    AiModelZeroRetentionRequiredError,
    generateSessionReportDraft: mocks.generateSessionReportDraft,
  }
})
vi.mock("@eleva/audit", () => ({ withAudit: mocks.withAudit }))
vi.mock("@eleva/db", () => ({
  hasActiveAiProcessingConsent: mocks.hasActiveAiProcessingConsent,
  withPlatformAdminContext: mocks.withPlatformAdminContext,
}))
vi.mock("@eleva/db/schema", () => ({
  records: {
    id: "records.id",
    kind: "records.kind",
    orgId: "records.org_id",
    bookingId: "records.booking_id",
    createdBy: "records.created_by",
    titleEncrypted: "records.title_encrypted",
    bodyEncrypted: "records.body_encrypted",
    version: "records.version",
  },
}))
vi.mock("@eleva/encryption", () => ({
  decryptRecordFields: mocks.decryptRecordFields,
  encryptRecordFields: mocks.encryptRecordFields,
}))
vi.mock("@eleva/observability", () => ({ registerPhi: vi.fn() }))
vi.mock("./record-logger", () => ({
  recordLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock("./session-records", () => ({
  requireAssignedExpert: mocks.requireAssignedExpert,
  listSessionRecords: mocks.listSessionRecords,
}))

import {
  AiModelNotApprovedError,
  AiModelZeroRetentionRequiredError,
} from "@eleva/ai"
import { draftSessionReport } from "./draft-session-report"
import { SessionRecordError } from "./errors"

const BOOKING = "00000000-0000-4000-8000-000000000001"
const ORG = "00000000-0000-4000-8000-000000000005"
const EXPERT = "00000000-0000-4000-8000-000000000003"
const PEER = "00000000-0000-4000-8000-000000000006"
const MEMBER = "00000000-0000-4000-8000-000000000004"
const NOTE_A = "00000000-0000-4000-8000-0000000000a1"
const NOTE_B = "00000000-0000-4000-8000-0000000000a2"

const input = (ids = [NOTE_A]) => ({
  bookingId: BOOKING,
  actorUserId: EXPERT,
  noteRecordIds: ids,
})

function noteRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    kind: "note",
    orgId: ORG,
    bookingId: BOOKING,
    createdBy: EXPERT,
    titleEncrypted: "t",
    bodyEncrypted: "b",
    ...overrides,
  }
}

function noteRows(rows: unknown[]) {
  mocks.withPlatformAdminContext.mockImplementation(
    async (fn: (tx: unknown) => unknown) =>
      fn({ select: () => ({ from: () => ({ where: async () => rows }) }) })
  )
}

async function code(promise: Promise<unknown>) {
  try {
    await promise
  } catch (err) {
    if (err instanceof SessionRecordError) return err.code
    throw err
  }
  return "resolved"
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset()
  mocks.requireAssignedExpert.mockResolvedValue({
    id: BOOKING,
    orgId: ORG,
    expertUserId: EXPERT,
    memberUserId: MEMBER,
  })
  mocks.hasActiveAiProcessingConsent.mockResolvedValue(true)
  mocks.listSessionRecords.mockResolvedValue([])
  mocks.decryptRecordFields.mockResolvedValue({
    reveal: () => ({ title: "Session notes", body: "private clinical note" }),
  })
  mocks.withAudit.mockImplementation(
    async (_o: unknown, fn: (tx: unknown, ctx: unknown) => unknown) =>
      fn({}, { emit: mocks.emit })
  )
})

describe("draftSessionReport guards (zero decrypt on every refusal)", () => {
  it("refuses an expert who is not assigned to the booking", async () => {
    mocks.requireAssignedExpert.mockRejectedValue(
      new SessionRecordError("FORBIDDEN")
    )
    expect(await code(draftSessionReport(input()))).toBe("FORBIDDEN")
    expect(mocks.hasActiveAiProcessingConsent).not.toHaveBeenCalled()
    expect(mocks.decryptRecordFields).not.toHaveBeenCalled()
    expect(mocks.generateSessionReportDraft).not.toHaveBeenCalled()
  })

  it("checks member consent before loading or decrypting any note", async () => {
    mocks.hasActiveAiProcessingConsent.mockResolvedValue(false)
    noteRows([noteRow(NOTE_A)])
    expect(await code(draftSessionReport(input()))).toBe("AI_CONSENT_REQUIRED")
    expect(mocks.withPlatformAdminContext).not.toHaveBeenCalled()
    expect(mocks.decryptRecordFields).not.toHaveBeenCalled()
    expect(mocks.generateSessionReportDraft).not.toHaveBeenCalled()
  })

  it("rejects a colleague's note (peer note => FORBIDDEN, nothing decrypted)", async () => {
    noteRows([noteRow(NOTE_A), noteRow(NOTE_B, { createdBy: PEER })])
    expect(await code(draftSessionReport(input([NOTE_A, NOTE_B])))).toBe(
      "FORBIDDEN"
    )
    expect(mocks.decryptRecordFields).not.toHaveBeenCalled()
    expect(mocks.generateSessionReportDraft).not.toHaveBeenCalled()
  })

  it.each([
    ["wrong kind", { kind: "internal_report" }],
    ["another booking", { bookingId: "00000000-0000-4000-8000-0000000000ff" }],
    ["another org", { orgId: "00000000-0000-4000-8000-0000000000fe" }],
  ])("rejects a note row with %s", async (_label, override) => {
    noteRows([noteRow(NOTE_A, override)])
    expect(await code(draftSessionReport(input()))).toBe("FORBIDDEN")
    expect(mocks.decryptRecordFields).not.toHaveBeenCalled()
  })

  it("rejects unknown note ids and an empty selection", async () => {
    noteRows([noteRow(NOTE_A)])
    expect(await code(draftSessionReport(input([NOTE_A, NOTE_B])))).toBe(
      "FORBIDDEN"
    )
    expect(await code(draftSessionReport(input([])))).toBe("FORBIDDEN")
    expect(mocks.decryptRecordFields).not.toHaveBeenCalled()
  })
})

describe("draftSessionReport model failures", () => {
  it("maps a zero-retention refusal to its code and writes a failed audit, no draft", async () => {
    noteRows([noteRow(NOTE_A)])
    mocks.generateSessionReportDraft.mockRejectedValue(
      new AiModelZeroRetentionRequiredError("openai/gpt-6-luna")
    )
    expect(await code(draftSessionReport(input()))).toBe(
      "AI_MODEL_ZERO_RETENTION_REQUIRED"
    )
    expect(mocks.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "ai_draft",
        action: "failed",
        payload: expect.objectContaining({
          reason: "AI_MODEL_ZERO_RETENTION_REQUIRED",
        }),
      })
    )
    expect(mocks.encryptRecordFields).not.toHaveBeenCalled()
  })

  it("maps an unapproved model to its code", async () => {
    noteRows([noteRow(NOTE_A)])
    mocks.generateSessionReportDraft.mockRejectedValue(
      new AiModelNotApprovedError("x/y")
    )
    expect(await code(draftSessionReport(input()))).toBe(
      "AI_MODEL_NOT_APPROVED"
    )
  })

  it("decrypts the author's own notes only after consent has been confirmed", async () => {
    noteRows([noteRow(NOTE_A)])
    mocks.generateSessionReportDraft.mockRejectedValue(
      new AiModelNotApprovedError("x/y")
    )
    await code(draftSessionReport(input()))
    expect(mocks.decryptRecordFields).toHaveBeenCalledTimes(1)
    expect(
      mocks.hasActiveAiProcessingConsent.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.decryptRecordFields.mock.invocationCallOrder[0]!)
    // Plaintext is only ever handed to the model call, never anywhere else.
    expect(mocks.generateSessionReportDraft).toHaveBeenCalledWith(
      expect.objectContaining({ noteTexts: ["private clinical note"] })
    )
  })
})
