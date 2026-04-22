/**
 * Shared type declarations for TipTap markdown editors
 *
 * The @tiptap/markdown package already augments @tiptap/core with:
 * - Editor.getMarkdown(): string
 * - Editor.markdown: MarkdownManager
 *
 * This file is kept for any future custom type augmentations needed
 * by the rich text editors in this project.
 */

// Re-export commonly used types from @tiptap/core for convenience
export type {
  JSONContent,
  MarkdownLexerConfiguration,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
} from '@tiptap/core';
