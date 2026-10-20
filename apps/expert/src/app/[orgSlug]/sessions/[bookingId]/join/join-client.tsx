"use client"

import { useCallback, useMemo } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  ApiClientError,
  createApiClient,
  RecordTemplatePhiErrorSchema,
} from "@eleva/api-client"
import {
  JoinSession,
  elevaCallLabels,
  parseInternalReport,
  type ElevaCallLabels,
  type ElevaCallRecords,
  type NoteTemplates,
  type SessionRecordBundle,
} from "@eleva/video/client"

const TEMPLATE_LOCALES = ["en", "pt", "es"] as const

export function JoinClient({
  bookingId,
  apiBaseUrl,
  backHref,
  templatesHref,
}: {
  bookingId: string
  apiBaseUrl: string
  backHref: string
  templatesHref: string
}) {
  const t = useTranslations("sessions.call")
  const uiLocale = useLocale()
  const labels = useMemo((): ElevaCallLabels => elevaCallLabels(t), [t])
  const api = useMemo(
    () => createApiClient({ baseUrl: apiBaseUrl }),
    [apiBaseUrl]
  )

  const join = useCallback(() => {
    return api.sessions.join(bookingId)
  }, [api, bookingId])

  const noteTemplates = useMemo((): NoteTemplates => {
    const locale = TEMPLATE_LOCALES.find((l) => l === uiLocale) ?? "en"
    return {
      manageHref: templatesHref,
      async list() {
        const { templates } = await api.recordTemplates.list({ kind: "note" })
        return templates.map(({ id, title }) => ({ id, title }))
      },
      async apply(templateId) {
        const filled = await api.recordTemplates.apply(templateId, bookingId)
        return filled.body
      },
      async save(body) {
        try {
          await api.recordTemplates.create({
            kind: "note",
            locale,
            title: t("notesTemplateDefaultTitle"),
            body,
            sourceBookingId: bookingId,
          })
          return "saved"
        } catch (err) {
          if (
            err instanceof ApiClientError &&
            RecordTemplatePhiErrorSchema.safeParse(err.body).success
          ) {
            return "phi"
          }
          throw err
        }
      },
    }
  }, [api, bookingId, t, templatesHref, uiLocale])

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
      noteTemplates,
    }
  }, [api, bookingId, noteTemplates])

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
