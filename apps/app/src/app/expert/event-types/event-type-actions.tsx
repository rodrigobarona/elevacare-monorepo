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
import { togglePublishAction, deleteEventTypeAction } from "./actions"

interface Props {
  eventTypeId: string
  published: boolean
}

export function EventTypeActions({ eventTypeId, published }: Props) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)

  async function handleTogglePublish() {
    setPending(true)
    await togglePublishAction(eventTypeId, !published)
    setPending(false)
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this event type?")) return
    setPending(true)
    await deleteEventTypeAction(eventTypeId)
    setPending(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={pending}>
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
        <DropdownMenuItem onSelect={handleDelete} className="text-destructive">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
