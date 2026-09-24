"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@eleva/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eleva/ui/components/card"
import { Input } from "@eleva/ui/components/input"
import { rotateFeedTokenAction, revokeFeedTokenAction } from "./actions"

type Props = {
  hasToken: boolean
  createdAt: string | null
}

export function IcsFeedCard({ hasToken: initialHasToken, createdAt }: Props) {
  const t = useTranslations("calendar")
  const [hasToken, setHasToken] = React.useState(initialHasToken)
  const [feedUrl, setFeedUrl] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function onRotate() {
    setPending(true)
    try {
      const result = await rotateFeedTokenAction()
      if (!result.ok) {
        toast.error(t(`error.${result.error}` as "error.rotate-failed"))
        return
      }
      setHasToken(true)
      setFeedUrl(result.data.feedUrl)
      toast.success(t("ics.rotated"))
    } finally {
      setPending(false)
    }
  }

  async function onRevoke() {
    setPending(true)
    try {
      const result = await revokeFeedTokenAction()
      if (!result.ok) {
        toast.error(t(`error.${result.error}` as "error.revoke-failed"))
        return
      }
      setHasToken(false)
      setFeedUrl(null)
      toast.success(t("ics.revoked"))
    } finally {
      setPending(false)
    }
  }

  async function onCopy() {
    if (!feedUrl) return
    try {
      await navigator.clipboard.writeText(feedUrl)
      toast.success(t("ics.copied"))
    } catch {
      toast.error(t("error.copy-failed"))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("ics.title")}</CardTitle>
        <CardDescription>{t("ics.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasToken ? (
          <p className="text-sm text-muted-foreground">
            {createdAt
              ? t("ics.activeSince", {
                  date: new Date(createdAt).toLocaleDateString(),
                })
              : t("ics.active")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("ics.empty")}</p>
        )}

        {feedUrl ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("ics.urlOnce")}</p>
            <div className="flex gap-2">
              <Input value={feedUrl} readOnly aria-label={t("ics.urlLabel")} />
              <Button onPress={onCopy}>{t("ics.copy")}</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("ics.subscribeHint")}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onPress={onRotate} isDisabled={pending}>
            {hasToken ? t("ics.rotate") : t("ics.create")}
          </Button>
          {hasToken ? (
            <Button variant="outline" onPress={onRevoke} isDisabled={pending}>
              {t("ics.revoke")}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
