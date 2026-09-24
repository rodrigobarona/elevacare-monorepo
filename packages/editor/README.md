# `@eleva/editor`

Single rich-text surface for Eleva (ADR-023). Plate (`platejs` / `@platejs/*`) and
Radix (Plate UI registry exception) are importable **only** in this package.

## Exports

| Export                                     | Use                                               |
| ------------------------------------------ | ------------------------------------------------- |
| `RichTextEditor`                           | Client editor (basic marks + headings + AI hooks) |
| `RichTextViewer`                           | Server-safe sanitized HTML viewer                 |
| `LocalizedRichTextField`                   | Locale tabs + per-locale editor                   |
| `buildLocalizedRichText`                   | Server: derive `html` / `text` from write payload |
| `toPlainText` / `toSanitizedHtmlFromValue` | Serialization helpers                             |
| `localizedRichText*Schema`                 | Zod contracts                                     |

## Storage

`LocalizedRichText` JSONB (see `@eleva/db` types + ADR-023): each locale holds
`{ json, html, text, source }`. Clients send JSON only; HTML is never trusted from
the wire.

## AI assist

Pass `ai={{ enabled: true, context: "marketing", onAssist }}` on
`RichTextEditor` / `LocalizedRichTextField`. `onAssist` should call
`createApiClient(...).ai.editorAssist(...)` (`POST /ai/editor`) and return the
streamed plain text. Context `"clinical"` is rejected until Phase 10.

## Not in this slice

- Full Plate shadcn registry restyle / `@platejs/ai` chat plugin
- Column migrations (`bio` / `description` → LocalizedRichText)
- `/dev/editor` demo route in `apps/expert`
