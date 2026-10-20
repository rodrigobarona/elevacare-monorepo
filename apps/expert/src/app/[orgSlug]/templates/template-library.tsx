"use client"

import { Fragment, useEffect, useMemo, useState, useTransition } from "react"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"
import {
  ApiClientError,
  createApiClient,
  RecordTemplatePhiErrorSchema,
  type RecordTemplate,
  type RecordTemplateKind,
  type StarterRecordTemplate,
  type TemplatePhiFinding,
} from "@eleva/api-client"
import { BookOpenIcon } from "@eleva/icons"
import { Alert, AlertDescription, AlertTitle } from "@eleva/ui/components/alert"
import { Button } from "@eleva/ui/components/button"
import { EmptyState } from "@eleva/ui/components/empty-state"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@eleva/ui/components/sheet"
import { StatusPill } from "@eleva/ui/components/status-pill"
import { Tabs, TabsList, TabsTrigger } from "@eleva/ui/components/tabs"
import { Textarea } from "@eleva/ui/components/textarea"

const KINDS: readonly RecordTemplateKind[] = [
  "note",
  "report",
  "consultation",
  "message",
]
const LOCALES = ["en", "pt", "es"] as const
type TemplateLocale = (typeof LOCALES)[number]

type Draft = {
  id: string | null
  kind: RecordTemplateKind
  locale: TemplateLocale
  title: string
  body: string
}

function toLocale(value: string): TemplateLocale {
  return LOCALES.find((l) => l === value) ?? "en"
}

function Highlighted({
  text,
  findings,
}: {
  text: string
  findings: readonly TemplatePhiFinding[]
}) {
  const parts: React.ReactNode[] = []
  let cursor = 0
  for (const finding of findings) {
    if (finding.start < cursor) continue
    parts.push(
      <Fragment key={`t${cursor}`}>
        {text.slice(cursor, finding.start)}
      </Fragment>
    )
    parts.push(
      <mark
        key={`m${finding.start}`}
        className="rounded bg-destructive/15 px-0.5 text-destructive"
      >
        {text.slice(finding.start, finding.end)}
      </mark>
    )
    cursor = finding.end
  }
  parts.push(<Fragment key="rest">{text.slice(cursor)}</Fragment>)
  return <p className="text-sm whitespace-pre-wrap">{parts}</p>
}

export function TemplateLibrary({ apiBaseUrl }: { apiBaseUrl: string }) {
  const t = useTranslations("templates")
  const uiLocale = toLocale(useLocale())
  const api = useMemo(
    () => createApiClient({ baseUrl: apiBaseUrl }),
    [apiBaseUrl]
  )
  const [templates, setTemplates] = useState<RecordTemplate[]>([])
  const [starters, setStarters] = useState<StarterRecordTemplate[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<string>("all")
  const [draft, setDraft] = useState<Draft | null>(null)
  const [findings, setFindings] = useState<TemplatePhiFinding[]>([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    api.recordTemplates
      .list()
      .then((result) => {
        if (cancelled) return
        setTemplates(result.templates)
        setStarters(result.starters)
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
  }, [api, t])

  const matchesFilter = (kind: RecordTemplateKind) =>
    filter === "all" || filter === kind
  const visible = templates.filter((tpl) => matchesFilter(tpl.kind))
  const visibleStarters = starters.filter(
    (s) => s.locale === uiLocale && matchesFilter(s.kind)
  )

  function openDraft(next: Draft) {
    setFindings([])
    setDraft(next)
  }

  function newDraft() {
    openDraft({
      id: null,
      kind: filter === "all" ? "note" : (filter as RecordTemplateKind),
      locale: uiLocale,
      title: "",
      body: "",
    })
  }

  function save() {
    if (!draft) return
    const current = draft
    startTransition(async () => {
      try {
        const saved = current.id
          ? await api.recordTemplates.update(current.id, {
              title: current.title,
              body: current.body,
            })
          : await api.recordTemplates.create({
              kind: current.kind,
              locale: current.locale,
              title: current.title,
              body: current.body,
            })
        setTemplates((list) => [
          ...list.filter((tpl) => tpl.id !== saved.id),
          saved,
        ])
        setDraft(null)
        toast.success(t("saved"))
      } catch (err) {
        const phi =
          err instanceof ApiClientError
            ? RecordTemplatePhiErrorSchema.safeParse(err.body)
            : null
        if (phi?.success) {
          setFindings(phi.data.findings)
          toast.error(t("phiDetected"))
          return
        }
        toast.error(t("saveFailed"))
      }
    })
  }

  function archive(template: RecordTemplate) {
    startTransition(async () => {
      try {
        await api.recordTemplates.archive(template.id)
        setTemplates((list) => list.filter((tpl) => tpl.id !== template.id))
        toast.success(t("archived"))
      } catch {
        toast.error(t("archiveFailed"))
      }
    })
  }

  const titleFindings = findings.filter((f) => f.field === "title")
  const bodyFindings = findings.filter((f) => f.field === "body")

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          selectedKey={filter}
          onSelectionChange={(key) => setFilter(String(key))}
        >
          <TabsList variant="line" className="flex-wrap">
            <TabsTrigger id="all">{t("filterAll")}</TabsTrigger>
            {KINDS.map((kind) => (
              <TabsTrigger key={kind} id={kind}>
                {t(`kind.${kind}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button onPress={newDraft}>{t("new")}</Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("yours")}</h2>
        {!loaded ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<BookOpenIcon />}
            title={t("emptyTitle")}
            description={t("emptyBody")}
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {visible.map((tpl) => (
              <li
                key={tpl.id}
                className="flex flex-col gap-3 rounded-3xl border bg-card p-5 text-card-foreground shadow-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone="neutral">
                    {t(`kind.${tpl.kind}`)}
                  </StatusPill>
                  <StatusPill tone="neutral">
                    {tpl.locale.toUpperCase()}
                  </StatusPill>
                  {tpl.isDefault ? (
                    <StatusPill tone="positive">{t("default")}</StatusPill>
                  ) : null}
                </div>
                <p className="font-medium">{tpl.title}</p>
                <p className="line-clamp-4 text-sm whitespace-pre-wrap text-muted-foreground">
                  {tpl.body}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() =>
                      openDraft({
                        id: tpl.id,
                        kind: tpl.kind,
                        locale: toLocale(tpl.locale),
                        title: tpl.title,
                        body: tpl.body,
                      })
                    }
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() =>
                      openDraft({
                        id: null,
                        kind: tpl.kind,
                        locale: toLocale(tpl.locale),
                        title: t("copyOf", { title: tpl.title }),
                        body: tpl.body,
                      })
                    }
                  >
                    {t("duplicate")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={isPending}
                    onPress={() => archive(tpl)}
                  >
                    {t("archive")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {visibleStarters.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{t("starters")}</h2>
            <p className="text-sm text-muted-foreground">{t("startersBody")}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {visibleStarters.map((starter) => (
              <li
                key={`${starter.key}-${starter.locale}`}
                className="flex flex-col gap-3 rounded-3xl border border-dashed p-5"
              >
                <StatusPill tone="neutral" className="self-start">
                  {t(`kind.${starter.kind}`)}
                </StatusPill>
                <p className="font-medium">{starter.title}</p>
                <p className="line-clamp-4 text-sm whitespace-pre-wrap text-muted-foreground">
                  {starter.body}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-auto self-start"
                  onPress={() =>
                    openDraft({
                      id: null,
                      kind: starter.kind,
                      locale: starter.locale,
                      title: starter.title,
                      body: starter.body,
                    })
                  }
                >
                  {t("useStarter")}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Sheet
        isOpen={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null)
        }}
        side="right"
        className="w-full sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>{draft?.id ? t("editTitle") : t("newTitle")}</SheetTitle>
          <SheetDescription>
            {t("placeholdersHint", {
              first: "{{member.firstName}}",
              date: "{{session.date}}",
              expert: "{{expert.name}}",
            })}
          </SheetDescription>
        </SheetHeader>
        {draft ? (
          <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
            {draft.id ? null : (
              <div className="space-y-2">
                <Label>{t("kindLabel")}</Label>
                <div className="flex flex-wrap gap-2">
                  {KINDS.map((kind) => (
                    <Button
                      key={kind}
                      size="sm"
                      variant={draft.kind === kind ? "secondary" : "outline"}
                      onPress={() => setDraft({ ...draft, kind })}
                    >
                      {t(`kind.${kind}`)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="template-title">{t("titleLabel")}</Label>
              <Input
                id="template-title"
                value={draft.title}
                maxLength={200}
                aria-invalid={titleFindings.length > 0 || undefined}
                onChange={(e) => {
                  setFindings([])
                  setDraft({ ...draft, title: e.target.value })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-body">{t("bodyLabel")}</Label>
              <Textarea
                id="template-body"
                value={draft.body}
                maxLength={20_000}
                className="min-h-64"
                aria-invalid={bodyFindings.length > 0 || undefined}
                onChange={(e) => {
                  setFindings([])
                  setDraft({ ...draft, body: e.target.value })
                }}
              />
            </div>
            {findings.length > 0 ? (
              <Alert variant="destructive">
                <AlertTitle>{t("phiTitle")}</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{t("phiBody")}</p>
                  {titleFindings.length > 0 ? (
                    <Highlighted text={draft.title} findings={titleFindings} />
                  ) : null}
                  {bodyFindings.length > 0 ? (
                    <Highlighted text={draft.body} findings={bodyFindings} />
                  ) : null}
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}
        <SheetFooter>
          <Button
            isDisabled={
              isPending || !draft?.title.trim() || !draft?.body.trim()
            }
            onPress={save}
          >
            {t("save")}
          </Button>
        </SheetFooter>
      </Sheet>
    </div>
  )
}
