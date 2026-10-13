"use client"

import { useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { createApiClient } from "@eleva/api-client"
import {
  JoinSession,
  elevaCallLabels,
  parseInternalReport,
  type ElevaCallLabels,
  type ElevaCallRecords,
  type SessionRecordBundle,
} from "@eleva/video/client"

export function JoinClient({
  bookingId,
  apiBaseUrl,
  backHref,
}: {
  bookingId: string
  apiBaseUrl: string
  backHref: string
}) {
  const t = useTranslations("sessions.call")
  const labels = useMemo((): ElevaCallLabels => elevaCallLabels(t), [t])
  const api = useMemo(
    () => createApiClient({ baseUrl: apiBaseUrl }),
    [apiBaseUrl]
  )

  const join = useCallback(() => {
    return api.sessions.join(bookingId)
  }, [api, bookingId])

  const records = useMemo((): ElevaCallRecords => {
    return {
      async load(): Promise<SessionRecordBundle> {
        const { records: rows } = await api.sessions.listRecords(bookingId)
        const byKind = new Map(rows.map((row) => [row.kind, row.body]))
        return {
          intake: byKind.get("intake") ?? "",
          note: byKind.get("note") ?? "",
          transcript: byKind.get("transcript") ?? "",
          internalReport: parseInternalReport(
            byKind.get("internal_report") ?? ""
          ),
        }
      },
      save(kind, body) {
        return api.sessions.upsertRecord(bookingId, { kind, body }).then(() => {
          /* persisted */
        })
      },
    }
  }, [api, bookingId])

  return (
    <JoinSession
      join={join}
      labels={labels}
      backHref={backHref}
      showNotesSlot
      records={records}
    />
  )
}
