"use client"

import { useTranslations } from "next-intl"
import type { RichTextEditorLabels } from "@eleva/editor/rich-text-editor"

/** Translated toolbar and AI-assist labels for `@eleva/editor`. */
export function useRichTextEditorLabels(
  placeholder: string
): RichTextEditorLabels {
  const t = useTranslations("richTextEditor")
  return {
    placeholder,
    bold: t("bold"),
    italic: t("italic"),
    underline: t("underline"),
    h1: t("h1"),
    h2: t("h2"),
    h3: t("h3"),
    blockquote: t("blockquote"),
    improve: t("improve"),
    shorten: t("shorten"),
    fixGrammar: t("fixGrammar"),
    assistEmpty: t("assistEmpty"),
    assistFailed: t("assistFailed"),
  }
}
