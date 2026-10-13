import { SessionRecordError } from "./errors"
import type { SessionRecordView } from "./session-records"

/**
 * AI summary of session notes + transcript. Fail closed until a
 * zero-retention model is on APPROVED_MODELS (ADR-009).
 * Authorization is enforced by the API route (assigned expert only).
 */
export async function summarizeSessionRecords(_input: {
  bookingId: string
  actorUserId: string
}): Promise<SessionRecordView> {
  throw new SessionRecordError("AI_MODEL_ZERO_RETENTION_REQUIRED")
}
