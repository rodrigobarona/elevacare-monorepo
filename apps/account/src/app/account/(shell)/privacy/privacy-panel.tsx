"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"
import { toast } from "sonner"
import type {
  ListMeConsentsResponse,
  ListMeRecordAccessOptoutsResponse,
} from "@eleva/api-client"
import { ArrowSquareOutIcon } from "@eleva/icons"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { CheckboxField } from "@eleva/ui/components/checkbox-field"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import {
  SettingsFieldset,
  SettingsFieldsetActions,
  SettingsFieldsetContent,
  SettingsFieldsetDescription,
  SettingsFieldsetFooter,
  SettingsFieldsetStatus,
  SettingsFieldsetTitle,
  SettingsRow,
} from "@eleva/ui/components/settings-fieldset"
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@eleva/ui/components/dialog"
import { Switch } from "@eleva/ui/components/switch"
import {
  cancelDeletion,
  getDataCopy,
  requestDataCopy,
  scheduleDeletion,
  updateConsent,
  updateRecordAccess,
} from "./actions"

type Consent = ListMeConsentsResponse["consents"][number]
type ConsentKind = Consent["kind"]
type RecordAccessChoice = ListMeRecordAccessOptoutsResponse["choices"][number]

/** Documents that apply while you use Eleva: shown with a date and a link. */
const AGREEMENTS = ["terms", "privacy"] as const
/** Consents you can give and take back at any time: shown as switches. */
const CHOICES = [
  "health_data_processing",
  "marketing",
  "ai_processing",
] as const

const DATA_COPY_STATUSES = [
  "pending",
  "processing",
  "ready",
  "expired",
  "failed",
] as const
type DataCopyStatus = (typeof DATA_COPY_STATUSES)[number]

/** Choices with more to say than one line: shown in a "Details" dialog. */
type DetailedChoice = "health_data_processing" | "ai_processing"

function isDetailed(kind: ConsentKind): kind is DetailedChoice {
  return kind === "health_data_processing" || kind === "ai_processing"
}

/** What a Server Action call that never reached the server resolves to. */
const UNREACHED = { ok: false, error: "generic" } as const

function isDataCopyStatus(value: string): value is DataCopyStatus {
  return (DATA_COPY_STATUSES as readonly string[]).includes(value)
}

interface PrivacyPanelProps {
  consents: Consent[]
  /** The published version of Terms and the Privacy notice. */
  currentVersion: string
  recordAccessChoices: RecordAccessChoice[]
  scheduledFor: string | null
  latestDataCopy: { id: string; status: string } | null
  documentUrls: Record<
    "terms" | "privacy" | "health_data_processing" | "ai_processing",
    string
  >
}

export function PrivacyPanel({
  consents,
  currentVersion,
  recordAccessChoices,
  scheduledFor,
  latestDataCopy,
  documentUrls,
}: PrivacyPanelProps) {
  const byKind = new Map(consents.map((row) => [row.kind, row]))
  // Cards keep local state for instant feedback; when a refresh brings
  // different server data (say, another tab changed it), they remount
  // from it instead of showing what this tab last knew.
  const consentKey = consents
    .map((row) => `${row.kind}:${row.grantedAt ?? ""}:${row.withdrawnAt ?? ""}`)
    .join("|")
  const recordAccessKey = recordAccessChoices
    .map((choice) => `${choice.orgId}:${choice.optedOut}`)
    .join("|")
  return (
    <div className="space-y-6">
      <AgreementsCard
        byKind={byKind}
        currentVersion={currentVersion}
        documentUrls={documentUrls}
      />
      <ChoicesCard
        key={consentKey}
        byKind={byKind}
        documentUrls={documentUrls}
      />
      {recordAccessChoices.length > 0 ? (
        <RecordAccessCard
          key={recordAccessKey}
          initialChoices={recordAccessChoices}
        />
      ) : null}
      <DataCopyCard
        key={latestDataCopy?.id ?? "none"}
        initial={latestDataCopy}
      />
      <DeletionCard
        key={scheduledFor ?? "none"}
        initialScheduledFor={scheduledFor}
      />
    </div>
  )
}

/** "2026-11-16" (a document version) → a Date at noon UTC, safe in any zone. */
function versionDate(version: string): Date | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(version)
    ? new Date(`${version}T12:00:00Z`)
    : null
}

/**
 * Terms and the Privacy notice are not choices: they show when they were
 * agreed to and link to the text. When there is no record, or the record
 * is for an older version, the person can agree to the current one here.
 */
function AgreementsCard({
  byKind,
  currentVersion,
  documentUrls,
}: {
  byKind: Map<ConsentKind, Consent>
  currentVersion: string
  documentUrls: PrivacyPanelProps["documentUrls"]
}) {
  const t = useTranslations("privacy.agreements")
  const tPrivacy = useTranslations("privacy")
  const format = useFormatter()
  const router = useRouter()
  const [pending, setPending] = useState<ConsentKind | null>(null)
  const date = (value: Date | null) =>
    value ? format.dateTime(value, { dateStyle: "medium" }) : ""
  const current = versionDate(currentVersion)

  async function onAgree(kind: (typeof AGREEMENTS)[number]) {
    setPending(kind)
    try {
      const result = await updateConsent({ kind, granted: true }).catch(
        () => UNREACHED
      )
      if (!result.ok) {
        toast.error(tPrivacy("error"))
        return
      }
      toast.success(t("saved"))
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle as="h2">{t("title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>
        <div className="mt-6">
          {AGREEMENTS.map((kind) => {
            const row = byKind.get(kind)
            const agreed = Boolean(row?.grantedAt && !row.withdrawnAt)
            const isCurrent = agreed && row?.version === currentVersion
            const meta = isCurrent
              ? t("agreedOn", { date: date(new Date(row!.grantedAt!)) })
              : agreed
                ? `${t("agreedOld", { date: date(versionDate(row!.version)) })} · ${t("updated", { date: date(current) })}`
                : t("updated", { date: date(current) })
            return (
              <SettingsRow
                key={kind}
                className="items-center"
                title={t(`kinds.${kind}`)}
                meta={meta}
                data-testid={`member-consent-${kind}`}
                data-granted={isCurrent ? "true" : "false"}
              >
                <LinkButton
                  href={documentUrls[kind]}
                  aria-label={t("readLabel", { document: t(`kinds.${kind}`) })}
                  target="_blank"
                  rel="noopener"
                  variant="ghost"
                  size="sm"
                  className={isCurrent ? "-mr-3" : undefined}
                >
                  {t("read")}
                  <ArrowSquareOutIcon aria-hidden data-icon="inline-end" />
                </LinkButton>
                {isCurrent ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={pending !== null}
                    onPress={() => void onAgree(kind)}
                    data-testid={`member-consent-agree-${kind}`}
                  >
                    {agreed ? t("agreeNew") : t("agree")}
                  </Button>
                )}
              </SettingsRow>
            )
          })}
        </div>
      </SettingsFieldsetContent>
    </SettingsFieldset>
  )
}

/**
 * Consents a person can give and take back. Each row states the purpose,
 * what it covers and what turning it on means; the rest is in a Details
 * dialog that links to the full notice (a layered notice). Each switch is
 * described by that line for screen readers.
 */
function ChoicesCard({
  byKind,
  documentUrls,
}: {
  byKind: Map<ConsentKind, Consent>
  documentUrls: PrivacyPanelProps["documentUrls"]
}) {
  const t = useTranslations("privacy.choices")
  const tPrivacy = useTranslations("privacy")
  const format = useFormatter()
  const router = useRouter()
  const [pending, setPending] = useState<ConsentKind | null>(null)
  const [state, setState] = useState(
    () =>
      new Map(
        CHOICES.map((kind) => {
          const row = byKind.get(kind)
          return [kind, Boolean(row?.grantedAt && !row.withdrawnAt)]
        })
      )
  )

  async function onToggle(kind: (typeof CHOICES)[number], granted: boolean) {
    setPending(kind)
    setState((current) => new Map(current).set(kind, granted))
    try {
      const result = await updateConsent({ kind, granted }).catch(
        () => UNREACHED
      )
      if (!result.ok) {
        setState((current) => new Map(current).set(kind, !granted))
        toast.error(
          result.error === "healthData"
            ? t("healthDataBlocked")
            : tPrivacy("error")
        )
        return
      }
      toast.success(granted ? t("granted") : t("withdrawn"))
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  // Layered notice: each row says what the choice is for and what turning
  // it on means; the rest is one tap away in "Details", before the switch.
  const [details, setDetails] = useState<DetailedChoice | null>(null)
  // Kept while the dialog fades out, so it never shows an empty box.
  const [shown, setShown] = useState<DetailedChoice>("health_data_processing")
  const openDetails = (kind: DetailedChoice) => {
    setShown(kind)
    setDetails(kind)
  }
  const noticeUrl: Record<DetailedChoice, string> = {
    health_data_processing: documentUrls.health_data_processing,
    ai_processing: documentUrls.ai_processing,
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle as="h2">{t("title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>
        <div className="mt-6">
          {CHOICES.map((kind) => {
            const row = byKind.get(kind)
            const on = state.get(kind) ?? false
            const descriptionId = `choice-${kind}-description`
            const since =
              on && row?.grantedAt
                ? t("onSince", {
                    date: format.dateTime(new Date(row.grantedAt), {
                      dateStyle: "medium",
                    }),
                  })
                : null
            return (
              <SettingsRow
                key={kind}
                title={
                  <span id={`choice-${kind}`}>{t(`kinds.${kind}.title`)}</span>
                }
                description={
                  <span className="block space-y-1">
                    <span id={descriptionId} className="block">
                      {t(`kinds.${kind}.description`)}
                    </span>
                    {isDetailed(kind) ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto min-h-6 px-0 text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        aria-label={t("detailsLabel", {
                          title: t(`kinds.${kind}.title`),
                        })}
                        onPress={() => openDetails(kind)}
                        data-testid={`member-consent-details-${kind}`}
                      >
                        {t("details")}
                      </Button>
                    ) : null}
                  </span>
                }
                meta={since}
                data-testid={`member-consent-${kind}`}
                data-granted={on ? "true" : "false"}
              >
                <Switch
                  aria-labelledby={`choice-${kind}`}
                  aria-describedby={descriptionId}
                  isSelected={on}
                  isDisabled={pending !== null}
                  onChange={(next) => void onToggle(kind, next)}
                  data-testid={`member-consent-switch-${kind}`}
                />
              </SettingsRow>
            )
          })}
        </div>
      </SettingsFieldsetContent>
      <Dialog
        showCloseButton={false}
        isOpen={details !== null}
        onOpenChange={(open) => {
          if (!open) setDetails(null)
        }}
      >
        <div className="grid gap-6" data-testid="member-consent-details">
          <DialogHeader>
            <DialogTitle>{t(`kinds.${shown}.title`)}</DialogTitle>
          </DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {(t.raw(`kinds.${shown}.details`) as string[]).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <DialogFooter>
            <LinkButton
              href={noticeUrl[shown]}
              target="_blank"
              rel="noopener"
              variant="outline"
              className="sm:mr-auto"
            >
              {t(`kinds.${shown}.noticeLink`)}
              <ArrowSquareOutIcon aria-hidden data-icon="inline-end" />
            </LinkButton>
            <Button onPress={() => setDetails(null)}>{t("close")}</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </SettingsFieldset>
  )
}

function RecordAccessCard({
  initialChoices,
}: {
  initialChoices: RecordAccessChoice[]
}) {
  const t = useTranslations("privacy.recordAccess")
  const tPrivacy = useTranslations("privacy")
  const [choices, setChoices] = useState(initialChoices)
  const [pending, setPending] = useState<string | null>(null)

  async function onChange(orgId: string, optedOut: boolean) {
    setPending(orgId)
    try {
      const result = await updateRecordAccess({ orgId, optedOut }).catch(
        () => UNREACHED
      )
      if (!result.ok) {
        toast.error(tPrivacy("error"))
        return
      }
      setChoices((current) =>
        current.map((choice) =>
          choice.orgId === orgId ? { ...choice, optedOut } : choice
        )
      )
      toast.success(optedOut ? t("optOutSaved") : t("optInSaved"))
    } finally {
      setPending(null)
    }
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle as="h2">{t("title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>
        <ul className="mt-6 space-y-4">
          {choices.map((choice) => (
            <li
              key={choice.orgId}
              className="border-t border-border/70 pt-4 first:border-t-0 first:pt-0"
              data-testid={`member-record-access-${choice.orgId}`}
            >
              <CheckboxField
                isSelected={choice.optedOut}
                isDisabled={pending !== null}
                onChange={(selected) => void onChange(choice.orgId, selected)}
                label={t("optOut", { clinic: choice.orgName })}
              />
              <p className="mt-1 text-sm text-muted-foreground">
                {choice.clinicSharedRecords
                  ? t("sharedOn", { clinic: choice.orgName })
                  : t("sharedOff", { clinic: choice.orgName })}
              </p>
            </li>
          ))}
        </ul>
      </SettingsFieldsetContent>
    </SettingsFieldset>
  )
}

/** Shows the latest request on arrival, so leaving the page loses nothing. */
function DataCopyCard({
  initial,
}: {
  initial: { id: string; status: string } | null
}) {
  const t = useTranslations("privacy.dsar")
  const [id, setId] = useState<string | null>(initial?.id ?? null)
  const [status, setStatus] = useState<string | null>(initial?.status ?? null)
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!id) return
    const requestId = id
    let cancelled = false
    async function refresh() {
      const result = await getDataCopy(requestId).catch(() => UNREACHED)
      if (cancelled || !result.ok) return
      setStatus(result.status)
      setDownloadUrl(result.downloadUrl)
    }
    void refresh()
    const polling =
      status === null || status === "pending" || status === "processing"
    const timer = polling ? setInterval(() => void refresh(), 4000) : null
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [id, status])

  async function onRequest() {
    setPending(true)
    try {
      const result = await requestDataCopy().catch(() => UNREACHED)
      if (!result.ok) {
        toast.error(t("error"))
        return
      }
      setId(result.id)
      setStatus(result.status)
      setDownloadUrl(undefined)
      toast.success(t("requested"))
    } finally {
      setPending(false)
    }
  }

  const busy = status === "pending" || status === "processing"

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle as="h2">{t("title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetStatus
          role="status"
          data-testid="member-dsar-status"
          data-status={status ?? undefined}
        >
          {status && isDataCopyStatus(status)
            ? status === "ready"
              ? `${t("status.ready")} ${t("downloadHint")}`
              : busy
                ? `${t(`status.${status}`)} ${t("leaveHint")}`
                : t(`status.${status}`)
            : null}
        </SettingsFieldsetStatus>
        <SettingsFieldsetActions>
          {downloadUrl ? (
            <>
              {/* The link expires after 24 hours: a page left open must
                  still offer a fresh copy. */}
              <Button
                size="sm"
                variant="ghost"
                isDisabled={pending}
                onPress={() => void onRequest()}
                data-testid="member-dsar-request-new"
              >
                {t("requestNew")}
              </Button>
              <LinkButton
                size="sm"
                href={downloadUrl}
                data-testid="member-dsar-download"
              >
                {t("download")}
              </LinkButton>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              isDisabled={pending || busy}
              onPress={() => void onRequest()}
              data-testid="member-dsar-request"
            >
              {pending ? t("requesting") : t("request")}
            </Button>
          )}
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>
    </SettingsFieldset>
  )
}

function DeletionCard({
  initialScheduledFor,
}: {
  initialScheduledFor: string | null
}) {
  const t = useTranslations("privacy.deletion")
  const format = useFormatter()
  const router = useRouter()
  const [scheduledFor, setScheduledFor] = useState(initialScheduledFor)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const scheduledDate = scheduledFor
    ? format.dateTime(new Date(scheduledFor), { dateStyle: "long" })
    : null

  async function onConfirm() {
    setPending(true)
    try {
      const result = await scheduleDeletion().catch(() => UNREACHED)
      if (!result.ok) {
        toast.error(
          result.error === "alreadyScheduled"
            ? t("alreadyScheduled")
            : t("error")
        )
        return
      }
      setScheduledFor(result.scheduledFor)
      setOpen(false)
      toast.success(
        t("scheduled", {
          date: format.dateTime(new Date(result.scheduledFor), {
            dateStyle: "long",
          }),
        })
      )
    } finally {
      setPending(false)
    }
  }

  async function onCancel() {
    setPending(true)
    try {
      const result = await cancelDeletion().catch(() => UNREACHED)
      if (!result.ok) {
        toast.error(t("error"))
        return
      }
      setScheduledFor(null)
      toast.success(t("cancelled"))
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <SettingsFieldset>
      <SettingsFieldsetContent>
        <SettingsFieldsetTitle as="h2">{t("title")}</SettingsFieldsetTitle>
        <SettingsFieldsetDescription>
          {t("description")}
        </SettingsFieldsetDescription>
      </SettingsFieldsetContent>
      <SettingsFieldsetFooter>
        <SettingsFieldsetStatus>
          {scheduledDate ? (
            <span data-testid="member-deletion-scheduled">
              {t("scheduled", { date: scheduledDate })}
            </span>
          ) : null}
        </SettingsFieldsetStatus>
        <SettingsFieldsetActions>
          {scheduledFor ? (
            <Button
              size="sm"
              variant="outline"
              isDisabled={pending}
              onPress={() => void onCancel()}
              data-testid="member-deletion-cancel"
            >
              {pending ? t("cancelling") : t("cancel")}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onPress={() => setOpen(true)}
              data-testid="member-deletion-request"
            >
              {t("button")}
            </Button>
          )}
        </SettingsFieldsetActions>
      </SettingsFieldsetFooter>

      {/* An alert dialog: it does not close on an outside click, and what
          is erased and kept is read here, before the irreversible step. */}
      <AlertDialog
        isOpen={open}
        onOpenChange={setOpen}
        className="data-[size=default]:sm:max-w-lg"
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
        </AlertDialogHeader>
        <div className="space-y-4 text-sm">
          <section className="space-y-1.5">
            <h3 className="font-medium">{t("eraseTitle")}</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {(t.raw("erase") as string[]).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
          <section className="space-y-1.5">
            <h3 className="font-medium">{t("keepTitle")}</h3>
            <p className="text-muted-foreground">{t("keep")}</p>
          </section>
          <section className="space-y-1.5">
            <h3 className="font-medium">{t("sessionsTitle")}</h3>
            <p className="text-muted-foreground">{t("sessions")}</p>
          </section>
          <p className="font-medium">{t("grace")}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel isDisabled={pending}>
            {t("keepOpen")}
          </AlertDialogCancel>
          {/* Solid, unlike the page's tinted button: this is the
              irreversible step. */}
          <Button
            variant="destructive"
            className="bg-destructive text-white hover:bg-destructive/90"
            isDisabled={pending}
            onPress={() => void onConfirm()}
            data-testid="member-deletion-confirm"
          >
            {pending ? t("scheduling") : t("confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </SettingsFieldset>
  )
}
