import { draftSessionReport } from "./draft-session-report"
import { SessionRecordError } from "./errors"
import { listSessionRecords, type SessionRecordView } from "./session-records"

/**
 * Legacy entrypoint used by `POST .../records/summarize`. Prefer
 * `POST /ai/session-report` with explicit `noteRecordIds`.
 */
export async function summarizeSessionRecords(input: {
  bookingId: string
  actorUserId: string
}): Promise<SessionRecordView> {
  const listed = await listSessionRecords(input)
  const noteRecordIds = listed
    .filter((row) => row.kind === "note")
    .map((row) => row.id)
  if (noteRecordIds.length === 0) {
    throw new SessionRecordError("FORBIDDEN")
  }
  return draftSessionReport({
    bookingId: input.bookingId,
    actorUserId: input.actorUserId,
    noteRecordIds,
  })
}
