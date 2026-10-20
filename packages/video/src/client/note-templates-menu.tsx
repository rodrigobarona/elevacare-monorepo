"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Button } from "@eleva/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@eleva/ui/components/dropdown-menu"
import type { ElevaCallLabels } from "./labels"

export type NoteTemplateSummary = { id: string; title: string }

export type NoteTemplates = {
  list: () => Promise<NoteTemplateSummary[]>
  apply: (templateId: string) => Promise<string>
  /** `phi` when the server refused the body for member details. */
  save: (body: string) => Promise<"saved" | "phi">
  manageHref: string
}

type Status = "applyFailed" | "saved" | "phi" | "saveFailed" | null

export function NoteTemplatesMenu({
  templates,
  labels,
  note,
  onApplied,
}: {
  templates: NoteTemplates
  labels: ElevaCallLabels
  note: string
  onApplied: (body: string) => void
}) {
  const [items, setItems] = useState<NoteTemplateSummary[]>([])
  const [status, setStatus] = useState<Status>(null)
  const [isPending, startTransition] = useTransition()
  const noteRef = useRef(note)

  useEffect(() => {
    noteRef.current = note
  }, [note])

  useEffect(() => {
    let cancelled = false
    templates
      .list()
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch(() => {
        // Templates are optional; notes work without them.
      })
    return () => {
      cancelled = true
    }
  }, [templates])

  function apply(templateId: string) {
    setStatus(null)
    startTransition(async () => {
      try {
        const filled = await templates.apply(templateId)
        const current = noteRef.current
        onApplied(current.trim() ? `${current}\n\n${filled}` : filled)
      } catch {
        setStatus("applyFailed")
      }
    })
  }

  function save() {
    setStatus(null)
    startTransition(async () => {
      try {
        const result = await templates.save(note)
        setStatus(result)
        if (result === "saved") {
          setItems(await templates.list().catch(() => items))
        }
      } catch {
        setStatus("saveFailed")
      }
    })
  }

  const message =
    status === "applyFailed"
      ? labels.notesTemplateApplyFailed
      : status === "saved"
        ? labels.notesTemplateSaved
        : status === "phi"
          ? labels.notesTemplatePhi
          : status === "saveFailed"
            ? labels.notesTemplateSaveFailed
            : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenuTrigger>
        <Button
          size="sm"
          variant="outline"
          isDisabled={isPending}
          data-testid="notes-templates"
        >
          {labels.notesTemplates}
        </Button>
        <DropdownMenu placement="bottom start">
          {items.map((template) => (
            <DropdownMenuItem
              key={template.id}
              id={template.id}
              textValue={template.title}
              onAction={() => apply(template.id)}
            >
              {labels.notesStartFrom(template.title)}
            </DropdownMenuItem>
          ))}
          {items.length > 0 ? <DropdownMenuSeparator /> : null}
          <DropdownMenuItem
            id="save-as-template"
            textValue={labels.notesSaveAsTemplate}
            isDisabled={!note.trim()}
            onAction={save}
          >
            {labels.notesSaveAsTemplate}
          </DropdownMenuItem>
          <DropdownMenuItem
            id="manage-templates"
            textValue={labels.notesManageTemplates}
            href={templates.manageHref}
            target="_blank"
          >
            {labels.notesManageTemplates}
          </DropdownMenuItem>
        </DropdownMenu>
      </DropdownMenuTrigger>
      {message ? (
        <p
          className={
            status === "saved"
              ? "text-xs text-muted-foreground"
              : "text-xs text-destructive"
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
