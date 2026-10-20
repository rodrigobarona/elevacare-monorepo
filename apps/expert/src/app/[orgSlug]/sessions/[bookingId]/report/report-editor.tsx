"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  ApiClientError,
  createApiClient,
  type BookingRecord,
} from "@eleva/api-client"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { Textarea } from "@eleva/ui/components/textarea"

const REPORT_MAX = 100_000

export function ReportEditor({
  bookingId,
  apiBaseUrl,
  backHref,
}: {
  bookingId: string
  apiBaseUrl: string
  backHref: string
}) {
  const t = useTranslations("sessions.report")
  const api = useMemo(
    () => createApiClient({ baseUrl: apiBaseUrl }),
    [apiBaseUrl]
  )
  const [record, setRecord] = useState<BookingRecord | null>(null)
  const [body, setBody] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    api.sessions
      .listRecords(bookingId)
      .then(({ records }) => {
        if (cancelled) return
        const report = records.find((row) => row.kind === "report") ?? null
        setRecord(report)
        setBody(report?.body ?? "")
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setLoaded(true)
        toast.error(t("loadFailed"))
      })
    return () => {
      cancelled = true
    }
  }, [api, bookingId, t])

  const isDirty = body !== (record?.body ?? "")
  const isPublished = record?.publishedAt != null

  function save() {
    startTransition(async () => {
      try {
        const saved = await api.sessions.upsertRecord(bookingId, {
          kind: "report",
          body,
        })
        setRecord(saved)
        toast.success(t("saved"))
      } catch {
        toast.error(t("saveFailed"))
      }
    })
  }

  function togglePublished() {
    if (!record) return
    startTransition(async () => {
      try {
        const updated = isPublished
          ? await api.sessions.unpublishRecord(bookingId, record.id)
          : await api.sessions.publishRecord(bookingId, record.id)
        setRecord(updated)
        toast.success(isPublished ? t("unpublishedToast") : t("publishedToast"))
      } catch (err) {
        const code = err instanceof ApiClientError ? err.body.error : null
        toast.error(
          code === "NOT_PUBLISHABLE" ? t("notPublishable") : t("publishFailed")
        )
      }
    })
  }

  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-lg">{t("editorTitle")}</h2>
        <StatusPill tone={isPublished ? "positive" : "neutral"}>
          {isPublished ? t("statusPublished") : t("statusDraft")}
        </StatusPill>
      </div>
      <p className="text-sm text-muted-foreground">{t("privacyHint")}</p>
      <Textarea
        aria-label={t("editorTitle")}
        className="min-h-64"
        value={body}
        maxLength={REPORT_MAX}
        disabled={!loaded || isPending}
        placeholder={t("placeholder")}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button onPress={save} isDisabled={!loaded || isPending || !isDirty}>
          {isPublished ? t("saveUpdateMember") : t("save")}
        </Button>
        <Button
          variant="outline"
          onPress={togglePublished}
          isDisabled={!record || isPending || isDirty}
        >
          {isPublished ? t("unpublish") : t("publish")}
        </Button>
        <LinkButton variant="ghost" href={backHref}>
          {t("back")}
        </LinkButton>
      </div>
      {isDirty && record ? (
        <p className="text-xs text-muted-foreground">
          {isPublished ? t("publishedEditHint") : t("saveBeforePublish")}
        </p>
      ) : null}
    </section>
  )
}
