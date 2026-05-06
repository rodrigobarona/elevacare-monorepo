"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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

export function EventTypeActions({ eventTypeId, published }: Props) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleTogglePublish() {
    setPending(true)
    setError(null)
    try {
      const result = await togglePublishAction(eventTypeId, !published)
      if (!result.ok) {
        setError(result.error)
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
        setError(result.error)
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
            aria-label="Event type actions"
          >
            &#x2022;&#x2022;&#x2022;
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => router.push(`/expert/event-types/${eventTypeId}`)}
          >
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleTogglePublish}>
            {published ? "Unpublish" : "Publish"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDeleteOpen(true)}
            className="text-destructive"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event type?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              event type and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              onClick={handleDeleteConfirm}
              disabled={pending}
              variant="destructive"
            >
              {pending ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
