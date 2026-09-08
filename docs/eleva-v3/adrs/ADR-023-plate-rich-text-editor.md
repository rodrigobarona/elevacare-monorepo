# ADR-023: Plate as the single rich-text editor

## Status

Accepted

## Date

2026-09-07

## Context

Eleva needs rich text on expert bios, event-type descriptions, location instructions,
clinical notes, reports, a reusable template library and clinic pages. Today those surfaces
are ad-hoc textareas or Markdown. AI writing help (improve, shorten, fix grammar, translate)
and visual templates need a structured document model, not HTML strings from the client.

Constraints: `@eleva/ui` is React Aria (ADR-022) and Radix is banned except documented
exceptions; clinical AI must use zero-retention models (Phase 10); clients must never send
HTML (XSS); locales are `pt | en | es` stored as JSONB keyed by `Locale` (one row, not
rows-per-language).

## Decision

1. **One package.** `packages/editor` (`@eleva/editor`) is the only Plate consumer. It
   exports `RichTextEditor`, `RichTextViewer` (RSC, sanitized HTML),
   `LocalizedRichTextField` (locale tabs + "Translate from `<source>`") and
   `toPlainText` / `toSanitizedHtml`.
2. **Storage.** Plate JSON is the editor value. Each consumer table stores one `jsonb`
   column typed `LocalizedRichText`:

   ```ts
   type LocalizedRichText = Partial<
     Record<
       Locale,
       {
         json: PlateValue
         html: string // server-derived, never client-sent
         text: string // plain text for FTS and previews
         source: "human" | "ai_draft"
       }
     >
   >
   ```

   Plain strings use `LocalizedText` (`Partial<Record<Locale, string>>`) from
   `packages/db/src/schema/main/shared.ts`. A sibling `_source_locale` column names the
   required key. HTML is written server-side from the JSON.

3. **UI.** Plate blocks come from the Plate shadcn registry into
   `packages/editor/src/components/ui` and are restyled with `@eleva/ui` tokens. `cn` and
   icons are rewritten to `@eleva/ui` / `@eleva/icons`.
4. **Boundary lint.** `platejs`, `@platejs/*`, `slate*` are importable only inside
   `packages/editor`. `@radix-ui/*` is allowed there as an ADR-022 exception (Plate's
   registry still ships Radix). The other ADR-022 exception (`@radix-ui/themes` as the
   WorkOS Widgets peer) dies in Phase 3.
5. **AI.** Assist commands (`improve | shorten | fix_grammar | translate`) go through
   `@eleva/ai` → Vercel AI Gateway with the `approved-models` allow-list. Context
   `"clinical"` is rejected until Phase 10 (zero-retention models). Translations mark the
   tab `source: "ai_draft"` until a human edits.
6. **Rollout.** Package created in Phase 4B (marketing/expert content). Phase 10 adds
   clinical notes, reports and the template library. Phase 11 uses it for clinic pages.

## Alternatives Considered

### Tiptap

- Pros: mature, Pro extensions for AI and comments.
- Cons: Pro licensing for the features we need; another paid vendor.

### Lexical

- Pros: Meta-backed, collaborative-ready.
- Cons: thinner React / shadcn ecosystem; we would own every styled primitive.

### Per-app Markdown textareas

- Pros: zero new package.
- Cons: no templates, no structured AI, inconsistent UX, XSS if any surface goes HTML.

## Consequences

- Positive: one editor to theme, sanitize and test; JSONB scales by adding a locale key;
  AI drafts are visible until reviewed.
- Tradeoff: Plate's Radix dependency is confined to one package; clinical AI waits for
  Phase 10.
- First implementation: Phase 4B. This ADR is written in Phase 1 so later phases do not
  pick a second editor.

## Related

- [`execution-plan/phases/04b-expert-offer-builder.md`](../execution-plan/phases/04b-expert-offer-builder.md),
  [`10-records-crm-ai.md`](../execution-plan/phases/10-records-crm-ai.md)
- [ADR-022](ADR-022-react-aria-ui-primitives.md)
- Plate docs: `https://platejs.org/docs/installation/next`
