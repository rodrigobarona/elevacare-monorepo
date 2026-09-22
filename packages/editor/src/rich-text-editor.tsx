"use client"

import { useEffect, useRef } from "react"
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

import type { EditorAiContext, PlateValue } from "./types"

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
}

export type RichTextEditorProps = {
  value?: PlateValue
  onChange?: (value: PlateValue) => void
  locale?: string
  className?: string
  isDisabled?: boolean
  labels?: Partial<RichTextEditorLabels>
  /**
   * AI assist wiring lands with `POST /ai/editor` in a later 04B PR.
   * `clinical` is rejected by the API until Phase 10.
   */
  ai?: {
    enabled: boolean
    context: EditorAiContext
  }
}

export function RichTextEditor({
  value,
  onChange,
  className,
  isDisabled = false,
  labels: labelsProp,
  ai: _ai,
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

  useEffect(() => {
    const next = value ?? EMPTY_VALUE
    if (next === lastEmittedRef.current) return
    lastEmittedRef.current = next
    editor.tf.setValue(next as Value)
  }, [editor, value])

  return (
    <Plate
      editor={editor}
      onChange={({ value: next }) => {
        const plateValue = next as PlateValue
        lastEmittedRef.current = plateValue
        onChange?.(plateValue)
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
            isDisabled={isDisabled}
            onPress={() => editor.tf.h1?.toggle()}
          >
            {labels.h1}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={isDisabled}
            onPress={() => editor.tf.h2?.toggle()}
          >
            {labels.h2}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={isDisabled}
            onPress={() => editor.tf.h3?.toggle()}
          >
            {labels.h3}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={isDisabled}
            onPress={() => editor.tf.blockquote?.toggle()}
          >
            {labels.blockquote}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={isDisabled}
            onPress={() => editor.tf.bold.toggle()}
          >
            {labels.bold}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={isDisabled}
            onPress={() => editor.tf.italic.toggle()}
          >
            {labels.italic}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            isDisabled={isDisabled}
            onPress={() => editor.tf.underline.toggle()}
          >
            {labels.underline}
          </Button>
        </div>
        <PlateContent
          className="min-h-32 px-3 py-2 text-sm outline-none"
          placeholder={labels.placeholder}
          disabled={isDisabled}
          readOnly={isDisabled}
        />
      </div>
    </Plate>
  )
}
