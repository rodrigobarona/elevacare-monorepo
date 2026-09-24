"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import type { Value } from "platejs"
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  BlockquotePlugin,
} from "@platejs/basic-nodes/react"
import { Plate, PlateContent, usePlateEditor } from "platejs/react"

import { Button } from "@eleva/ui/components/button"
import { cn } from "@eleva/ui/lib/utils"

import type { EditorAiContext, PlateValue, RichTextSource } from "./types"
import { toPlainTextFromNodes } from "./types"

const EMPTY_VALUE: PlateValue = [{ type: "p", children: [{ text: "" }] }]

export type RichTextEditorLabels = {
  placeholder: string
  bold: string
  italic: string
  underline: string
  h1: string
  h2: string
  h3: string
  blockquote: string
  improve: string
  shorten: string
  fixGrammar: string
}

const DEFAULT_LABELS: RichTextEditorLabels = {
  placeholder: "Write…",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  h1: "H1",
  h2: "H2",
  h3: "H3",
  blockquote: "Quote",
  improve: "Improve",
  shorten: "Shorten",
  fixGrammar: "Fix grammar",
}

export type EditorAiAssistCommand = "improve" | "shorten" | "fix_grammar"

export type RichTextEditorProps = {
  value?: PlateValue
  onChange?: (value: PlateValue) => void
  locale?: string
  className?: string
  isDisabled?: boolean
  labels?: Partial<RichTextEditorLabels>
  /**
   * When `enabled`, shows assist actions. `clinical` is rejected by
   * `POST /ai/editor` until Phase 10 — keep `context: "marketing"` in 04B.
   * `onAssist` should call the API and return revised plain text for the
   * full document (marks/headings are flattened on apply).
   */
  ai?: {
    enabled: boolean
    context: EditorAiContext
    onAssist?: (
      command: EditorAiAssistCommand,
      text: string,
      locale?: string
    ) => Promise<string> | string
  }
  /**
   * When set, human edits and AI applies report a source so consumers can
   * mark `ai_draft` until the next human edit.
   */
  onChangeWithSource?: (value: PlateValue, source: RichTextSource) => void
}

function plainTextToPlateValue(text: string): PlateValue {
  const paragraphs = text.split(/\n+/u).filter((part) => part.length > 0)
  if (paragraphs.length === 0) return EMPTY_VALUE
  return paragraphs.map((paragraph) => ({
    type: "p",
    children: [{ text: paragraph }],
  }))
}

export function RichTextEditor({
  value,
  onChange,
  onChangeWithSource,
  className,
  isDisabled = false,
  labels: labelsProp,
  locale,
  ai,
}: RichTextEditorProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp }
  const editor = usePlateEditor({
    plugins: [
      BoldPlugin,
      ItalicPlugin,
      UnderlinePlugin,
      H1Plugin,
      H2Plugin,
      H3Plugin,
      BlockquotePlugin,
    ],
    value: (value ?? EMPTY_VALUE) as Value,
  })
  const lastEmittedRef = useRef<PlateValue | undefined>(value)
  const [assistError, setAssistError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const next = value ?? EMPTY_VALUE
    if (next === lastEmittedRef.current) return
    lastEmittedRef.current = next
    editor.tf.setValue(next as Value)
  }, [editor, value])

  const emitChange = (plateValue: PlateValue, source: RichTextSource) => {
    lastEmittedRef.current = plateValue
    onChange?.(plateValue)
    onChangeWithSource?.(plateValue, source)
  }

  const runAssist = (command: EditorAiAssistCommand) => {
    const onAssist = ai?.onAssist
    if (!ai?.enabled || !onAssist || isDisabled) return
    const text = toPlainTextFromNodes(
      (editor.children as PlateValue) ?? EMPTY_VALUE
    )
    if (!text.trim()) return

    setAssistError(null)
    startTransition(async () => {
      try {
        const nextText = await onAssist(command, text, locale)
        if (!nextText.trim()) {
          setAssistError("AI assist returned no text")
          return
        }
        const nextValue = plainTextToPlateValue(nextText)
        editor.tf.setValue(nextValue as Value)
        emitChange(nextValue, "ai_draft")
      } catch (err) {
        setAssistError(err instanceof Error ? err.message : "AI assist failed")
      }
    })
  }

  const aiDisabled = isDisabled || isPending || !ai?.enabled || !ai.onAssist
  const contentDisabled = isDisabled || isPending

  return (
    <Plate
      editor={editor}
      onChange={({ value: next }) => {
        if (isPending) return
        emitChange(next as PlateValue, "human")
      }}
    >
      <div
        className={cn(
          "rounded-md border border-input bg-background shadow-xs",
          isDisabled && "opacity-60",
          className
        )}
      >
        <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={contentDisabled}
            onPress={() => editor.tf.h1?.toggle()}
          >
            {labels.h1}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={contentDisabled}
            onPress={() => editor.tf.h2?.toggle()}
          >
            {labels.h2}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={contentDisabled}
            onPress={() => editor.tf.h3?.toggle()}
          >
            {labels.h3}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={contentDisabled}
            onPress={() => editor.tf.blockquote?.toggle()}
          >
            {labels.blockquote}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={contentDisabled}
            onPress={() => editor.tf.bold.toggle()}
          >
            {labels.bold}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={contentDisabled}
            onPress={() => editor.tf.italic.toggle()}
          >
            {labels.italic}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={contentDisabled}
            onPress={() => editor.tf.underline.toggle()}
          >
            {labels.underline}
          </Button>
          {ai?.enabled ? (
            <>
              <span aria-hidden className="mx-1 w-px self-stretch bg-border" />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                isDisabled={aiDisabled}
                onPress={() => runAssist("improve")}
              >
                {labels.improve}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                isDisabled={aiDisabled}
                onPress={() => runAssist("shorten")}
              >
                {labels.shorten}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                isDisabled={aiDisabled}
                onPress={() => runAssist("fix_grammar")}
              >
                {labels.fixGrammar}
              </Button>
            </>
          ) : null}
        </div>
        <PlateContent
          className="min-h-32 px-3 py-2 text-sm outline-none"
          placeholder={labels.placeholder}
          disabled={contentDisabled}
          readOnly={contentDisabled}
        />
        {assistError ? (
          <p className="border-t border-border px-3 py-1.5 text-xs text-destructive">
            {assistError}
          </p>
        ) : null}
      </div>
    </Plate>
  )
}
