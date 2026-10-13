import { describe, expect, it } from "vitest"
import {
  isWritableSessionRecordKind,
  SESSION_RECORD_KINDS,
  SessionDocumentError,
  SessionRecordError,
} from "./errors"

describe("session record kinds", () => {
  it("keeps intake read-only for expert upserts", () => {
    expect(isWritableSessionRecordKind("intake")).toBe(false)
    expect(isWritableSessionRecordKind("note")).toBe(true)
    expect(isWritableSessionRecordKind("transcript")).toBe(true)
    expect(isWritableSessionRecordKind("ai_draft")).toBe(false)
    expect(isWritableSessionRecordKind("internal_report")).toBe(true)
    expect(isWritableSessionRecordKind("report")).toBe(false)
    expect(SESSION_RECORD_KINDS).toContain("intake")
    expect(SESSION_RECORD_KINDS).toContain("internal_report")
  })

  it("exposes a closed error code", () => {
    const err = new SessionRecordError("INTAKE_READONLY")
    expect(err.code).toBe("INTAKE_READONLY")
    expect(err.name).toBe("SessionRecordError")
  })

  it("exposes document error codes", () => {
    const err = new SessionDocumentError("INVALID_PATHNAME")
    expect(err.code).toBe("INVALID_PATHNAME")
    expect(err.name).toBe("SessionDocumentError")
  })
})
