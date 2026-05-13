"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@eleva/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@eleva/ui/components/alert-dialog"
import { togglePublishAction, deleteEventTypeAction } from "./actions"

interface Props {
  eventTypeId: string
  published: boolean
}

const ERROR_KEYS = ["no-profile", "toggle-failed", "delete-failed"] as const

export function EventTypeActions({ eventTypeId, published }: Props) {
  const router = useRouter()
  const t = useTranslations("eventTypes")
  const [pending, setPending] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function friendlyError(code: string): string {
    if ((ERROR_KEYS as readonly string[]).includes(code)) {
      return t(`error.${code}` as Parameters<typeof t>[0])
    }
    return t("error.generic")
  }

  async function handleTogglePublish() {
    setPending(true)
    setError(null)
    try {
      const result = await togglePublishAction(eventTypeId, !published)
      if (!result.ok) {
        setError(friendlyError(result.error))
        return
      }
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  async function handleDeleteConfirm() {
    setPending(true)
    setError(null)
    try {
      const result = await deleteEventTypeAction(eventTypeId)
      if (!result.ok) {
        setError(friendlyError(result.error))
        return
      }
      setDeleteOpen(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label={t("actions.ariaLabel")}
          >
            &#x2022;&#x2022;&#x2022;
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => router.push(`/expert/event-types/${eventTypeId}`)}
          >
            {t("actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleTogglePublish}>
            {published ? t("actions.unpublish") : t("actions.publish")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive"
          >
            {t("actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("actions.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("actions.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>
              {t("actions.cancel")}
            </AlertDialogCancel>
            <Button
              onClick={handleDeleteConfirm}
              disabled={pending}
              variant="destructive"
            >
              {pending ? t("actions.deleting") : t("actions.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
