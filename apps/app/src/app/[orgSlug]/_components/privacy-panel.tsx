"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import type { ListMeConsentsResponse } from "@eleva/api-client"
import { Button, LinkButton } from "@eleva/ui/components/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
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
  SettingsFieldsetTitle,
} from "@eleva/ui/components/settings-fieldset"
import {
  cancelDeletionAction,
  deleteAccountAction,
  getDsarAction,
  requestDsarAction,
  updateConsentAction,
} from "../actions"

type MemberConsent = ListMeConsentsResponse["consents"][number]
type ConsentKind = MemberConsent["kind"]

const CONSENT_KINDS: ConsentKind[] = [
  "terms",
  "privacy",
  "health_data_processing",
  "marketing",
]

const DSAR_STATUS_KEYS = [
  "pending",
  "processing",
  "ready",
  "expired",
  "failed",
] as const
type DsarStatus = (typeof DSAR_STATUS_KEYS)[number]

function isDsarStatus(value: string): value is DsarStatus {
  return (DSAR_STATUS_KEYS as readonly string[]).includes(value)
}

interface PrivacyPanelProps {
  orgSlug: string
  consents: MemberConsent[]
  scheduledFor: string | null
}

export function PrivacyPanel({
  orgSlug,
  consents,
  scheduledFor: initialScheduledFor,
}: PrivacyPanelProps) {
  const t = useTranslations("privacy")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const router = useRouter()
  const [consentPending, setConsentPending] = useState<string | null>(null)
  const [dsarId, setDsarId] = useState<string | null>(null)
  const [dsarStatus, setDsarStatus] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | undefined>()
  const [dsarPending, setDsarPending] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [scheduledFor, setScheduledFor] = useState<string | null>(
    initialScheduledFor
  )

  useEffect(() => {
    if (!dsarId) return
    const requestId = dsarId
    let cancelled = false

    async function refresh() {
      const result = await getDsarAction(requestId)
      if (cancelled || !result.ok) return
      setDsarStatus(result.status)
      setDownloadUrl(result.downloadUrl)
    }

    void refresh()
    const shouldPoll =
      dsarStatus === "pending" ||
      dsarStatus === "processing" ||
      dsarStatus === null
    if (!shouldPoll) return
    const timer = setInterval(() => {
      void refresh()
    }, 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [dsarId, dsarStatus])

  async function handleConsent(kind: ConsentKind, granted: boolean) {
    setConsentPending(kind)
    try {
      const result = await updateConsentAction(orgSlug, { kind, granted })
      if (!result.ok) {
        toast.error(
          result.error === "healthData"
            ? t("consents.healthDataBlocked")
            : te("generic")
        )
        return
      }
      toast.success(
        granted ? t("consents.grantedToast") : t("consents.withdrawnToast")
      )
      router.refresh()
    } finally {
      setConsentPending(null)
    }
  }

  async function handleDsar() {
    setDsarPending(true)
    try {
      const result = await requestDsarAction()
      if (!result.ok) {
        toast.error(t("dsar.error"))
        return
      }
      setDsarId(result.id)
      setDsarStatus(result.status)
      setDownloadUrl(undefined)
      toast.success(t("dsar.requested"))
    } finally {
      setDsarPending(false)
    }
  }

  async function handleDelete() {
    setDeletePending(true)
    try {
      const result = await deleteAccountAction()
      if (!result.ok) {
        if (result.error === "alreadyScheduled") {
          toast.error(t("deletion.alreadyScheduled"))
        } else {
          toast.error(t("dsar.error"))
        }
        return
      }
      setScheduledFor(result.scheduledFor)
      setDeleteOpen(false)
      toast.success(
        t("deletion.scheduled", {
          date: new Date(result.scheduledFor).toLocaleString(),
        })
      )
    } finally {
      setDeletePending(false)
    }
  }

  async function handleCancelDeletion() {
    setDeletePending(true)
    try {
      const result = await cancelDeletionAction()
      if (!result.ok) {
        toast.error(t("dsar.error"))
        return
      }
      setScheduledFor(null)
      toast.success(t("deletion.cancelled"))
      router.refresh()
    } finally {
      setDeletePending(false)
    }
  }

  const consentByKind = new Map(consents.map((row) => [row.kind, row]))

  return (
    <div className="space-y-6">
      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("consents.title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("consents.description")}
          </SettingsFieldsetDescription>
          <ul className="mt-4 space-y-4">
            {CONSENT_KINDS.map((kind) => {
              const row = consentByKind.get(kind)
              const granted = Boolean(row?.grantedAt && !row.withdrawnAt)
              return (
                <li
                  key={kind}
                  className="flex flex-col gap-2 border-b border-border/60 pb-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{t(`consents.kinds.${kind}`)}</p>
                    <p className="text-sm text-muted-foreground">
                      {row?.version
                        ? t("consents.version", { version: row.version })
                        : t("consents.notGranted")}
                      {row?.grantedAt
                        ? ` · ${t("consents.granted", { date: row.grantedAt.slice(0, 10) })}`
                        : null}
                      {row?.withdrawnAt
                        ? ` · ${t("consents.withdrawn", { date: row.withdrawnAt.slice(0, 10) })}`
                        : null}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={granted ? "outline" : "default"}
                    isDisabled={consentPending === kind}
                    onPress={() => handleConsent(kind, !granted)}
                  >
                    {granted ? t("consents.withdraw") : t("consents.grant")}
                  </Button>
                </li>
              )
            })}
          </ul>
        </SettingsFieldsetContent>
      </SettingsFieldset>

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("dsar.title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("dsar.description")}
          </SettingsFieldsetDescription>
          {dsarStatus ? (
            <p className="mt-4 text-sm" data-testid="member-dsar-status">
              {t("dsar.status", {
                status: isDsarStatus(dsarStatus)
                  ? t(`dsar.statusLabel.${dsarStatus}`)
                  : dsarStatus,
              })}
            </p>
          ) : null}
        </SettingsFieldsetContent>
        <SettingsFieldsetFooter>
          <SettingsFieldsetActions>
            {downloadUrl ? (
              <LinkButton
                size="sm"
                href={downloadUrl}
                target="_blank"
                data-testid="member-dsar-download"
              >
                {t("dsar.download")}
              </LinkButton>
            ) : null}
            <Button
              size="sm"
              isDisabled={dsarPending}
              onPress={handleDsar}
              data-testid="member-dsar-request"
            >
              {dsarPending ? t("dsar.requesting") : t("dsar.request")}
            </Button>
          </SettingsFieldsetActions>
        </SettingsFieldsetFooter>
      </SettingsFieldset>

      <SettingsFieldset>
        <SettingsFieldsetContent>
          <SettingsFieldsetTitle>{t("deletion.title")}</SettingsFieldsetTitle>
          <SettingsFieldsetDescription>
            {t("deletion.description")}
          </SettingsFieldsetDescription>
          <div className="mt-4 space-y-3 text-sm">
            <p className="font-medium">{t("deletion.ruleTitle")}</p>
            <p className="text-muted-foreground">{t("deletion.ruleBody")}</p>
            <p className="text-muted-foreground">{t("deletion.grace")}</p>
            {scheduledFor ? (
              <p>
                {t("deletion.scheduled", {
                  date: new Date(scheduledFor).toLocaleString(),
                })}
              </p>
            ) : null}
          </div>
        </SettingsFieldsetContent>
        <SettingsFieldsetFooter>
          <SettingsFieldsetActions>
            {scheduledFor ? (
              <Button
                size="sm"
                variant="outline"
                isDisabled={deletePending}
                onPress={handleCancelDeletion}
              >
                {deletePending
                  ? t("deletion.cancelling")
                  : t("deletion.cancelRequest")}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onPress={() => setDeleteOpen(true)}
              >
                {t("deletion.title")}
              </Button>
            )}
          </SettingsFieldsetActions>
        </SettingsFieldsetFooter>
      </SettingsFieldset>

      <AlertDialog isOpen={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deletion.confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deletion.confirmBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel isDisabled={deletePending}>
            {tc("cancel")}
          </AlertDialogCancel>
          <Button
            variant="destructive"
            isDisabled={deletePending}
            onPress={handleDelete}
          >
            {deletePending ? t("deletion.scheduling") : t("deletion.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </div>
  )
}
