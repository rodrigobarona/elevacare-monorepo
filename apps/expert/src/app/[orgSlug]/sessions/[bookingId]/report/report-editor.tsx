"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  ApiClientError,
  createApiClient,
  RecordTemplatePhiErrorSchema,
  type BookingRecord,
  type RecordTemplate,
  type TemplatePhiFinding,
} from "@eleva/api-client"
import { Alert, AlertDescription, AlertTitle } from "@eleva/ui/components/alert"
import { Button, LinkButton } from "@eleva/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { Textarea } from "@eleva/ui/components/textarea"
import { PhiHighlight } from "../../../templates/phi-highlight"

const REPORT_MAX = 100_000
const TEMPLATE_LOCALES = ["en", "pt", "es"] as const

export function ReportEditor({
  bookingId,
  apiBaseUrl,
  backHref,
  templatesHref,
  aiReportsBeta,
}: {
  bookingId: string
  apiBaseUrl: string
  backHref: string
  templatesHref: string
  aiReportsBeta: boolean
}) {
  const t = useTranslations("sessions.report")
  const uiLocale = useLocale()
  const templateLocale = TEMPLATE_LOCALES.find((l) => l === uiLocale) ?? "en"
  const api = useMemo(
    () => createApiClient({ baseUrl: apiBaseUrl }),
    [apiBaseUrl]
  )
  const [record, setRecord] = useState<BookingRecord | null>(null)
  const [body, setBody] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [templates, setTemplates] = useState<RecordTemplate[]>([])
  const [phiFindings, setPhiFindings] = useState<TemplatePhiFinding[]>([])
  const [phiScannedBody, setPhiScannedBody] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    api.recordTemplates
      .list({ kind: "report" })
      .then((result) => {
        if (!cancelled) setTemplates(result.templates)
      })
      .catch(() => {
        // Templates are optional; the editor works without them.
      })
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

  function startFromTemplate(templateId: string) {
    startTransition(async () => {
      try {
        const filled = await api.recordTemplates.apply(templateId, bookingId)
        setBody((current) =>
          current.trim() ? `${current}\n\n${filled.body}` : filled.body
        )
      } catch {
        toast.error(t("templateApplyFailed"))
      }
    })
  }

  function saveAsTemplate() {
    setPhiFindings([])
    startTransition(async () => {
      try {
        const created = await api.recordTemplates.create({
          kind: "report",
          locale: templateLocale,
          title: t("templateDefaultTitle"),
          body,
          sourceBookingId: bookingId,
        })
        setTemplates((list) => [...list, created])
        toast.success(t("templateSaved"))
      } catch (err) {
        const phi =
          err instanceof ApiClientError
            ? RecordTemplatePhiErrorSchema.safeParse(err.body)
            : null
        if (phi?.success) {
          setPhiFindings(phi.data.findings.filter((f) => f.field === "body"))
          setPhiScannedBody(phi.data.scanned?.body ?? null)
          toast.error(t("templatePhi"))
          return
        }
        toast.error(t("templateSaveFailed"))
      }
    })
  }

  function draftWithAi() {
    startTransition(async () => {
      try {
        const { records } = await api.sessions.listRecords(bookingId)
        const noteRecordIds = records
          .filter((row) => row.kind === "note")
          .map((row) => row.id)
        if (noteRecordIds.length === 0) {
          toast.error(t("draftWithAiNoNotes"))
          return
        }
        const { record: draft } = await api.ai.draftSessionReport({
          bookingId,
          noteRecordIds,
        })
        setBody((current) =>
          current.trim() ? `${current}\n\n${draft.body}` : draft.body
        )
        toast.success(t("draftWithAiReady"))
      } catch {
        toast.error(t("draftWithAiFailed"))
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
        onChange={(event) => {
          setPhiFindings([])
          setBody(event.target.value)
        }}
      />
      {phiFindings.length > 0 ? (
        <Alert variant="destructive">
          <AlertTitle>{t("templatePhiTitle")}</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{t("templatePhiBody")}</p>
            <PhiHighlight
              text={phiScannedBody ?? body}
              findings={phiFindings}
            />
          </AlertDescription>
        </Alert>
      ) : null}
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
        {aiReportsBeta ? (
          <Button
            variant="outline"
            onPress={draftWithAi}
            isDisabled={!loaded || isPending}
          >
            {t("draftWithAi")}
          </Button>
        ) : null}
        <DropdownMenuTrigger>
          <Button variant="outline" isDisabled={!loaded || isPending}>
            {t("templatesMenu")}
          </Button>
          <DropdownMenu placement="bottom start">
            {templates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                id={template.id}
                textValue={template.title}
                onAction={() => startFromTemplate(template.id)}
              >
                {t("startFrom", { title: template.title })}
              </DropdownMenuItem>
            ))}
            {templates.length > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              id="save-as-template"
              textValue={t("saveAsTemplate")}
              isDisabled={!body.trim()}
              onAction={saveAsTemplate}
            >
              {t("saveAsTemplate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              id="manage-templates"
              textValue={t("manageTemplates")}
              href={templatesHref}
            >
              {t("manageTemplates")}
            </DropdownMenuItem>
          </DropdownMenu>
        </DropdownMenuTrigger>
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
