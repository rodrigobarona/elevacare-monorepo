"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Button, LinkButton } from "@eleva/ui/components/button"
import { Input } from "@eleva/ui/components/input"
import { Label } from "@eleva/ui/components/label"
import { toast } from "sonner"
import { exportSaftAction } from "./actions"

const ERROR_KEYS = [
  "flag_disabled",
  "not_found",
  "already_issued",
  "not_retryable",
  "already_manual",
  "payment_not_succeeded",
  "forbidden",
  "validation",
  "blocked",
  "conflict",
] as const

function currentLisbonMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  return year && month ? `${year}-${month}` : now.toISOString().slice(0, 7)
}

export function MonthlyExport() {
  const t = useTranslations("finance.invoices")
  const [month, setMonth] = React.useState(currentLisbonMonth)
  const [pending, setPending] = React.useState(false)
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null)

  function friendlyError(code: string): string {
    if ((ERROR_KEYS as readonly string[]).includes(code)) {
      return t(`errors.${code}` as Parameters<typeof t>[0])
    }
    return t("errors.generic")
  }

  async function handleExport() {
    setPending(true)
    setDownloadUrl(null)
    try {
      const result = await exportSaftAction(month)
      if (!result.ok) {
        toast.error(friendlyError(result.error))
        return
      }
      setDownloadUrl(result.export.downloadUrl)
      if (result.export.truncated) {
        toast.warning(t("exportTruncated"))
      } else {
        toast.success(t("exportReady"))
      }
    } catch {
      toast.error(t("errors.generic"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="saft-month">{t("exportMonth")}</Label>
        <Input
          id="saft-month"
          type="month"
          value={month}
          onChange={(event) => {
            setMonth(event.target.value)
            setDownloadUrl(null)
          }}
        />
      </div>
      <Button
        variant="outline"
        isDisabled={pending || month.length === 0}
        onPress={() => {
          void handleExport()
        }}
      >
        {pending ? t("exporting") : t("exportSaft")}
      </Button>
      {downloadUrl ? (
        <LinkButton
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="default"
        >
          {t("openExport")}
        </LinkButton>
      ) : null}
      <p className="text-sm text-muted-foreground sm:flex-1">
        {t("exportHint")}
      </p>
    </div>
  )
}
