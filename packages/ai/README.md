# `@eleva/ai`

Vercel AI Gateway client and allow-listed model contracts (ADR-023).

## Exports

| Export                      | Use                                                                 |
| --------------------------- | ------------------------------------------------------------------- |
| `APPROVED_MODELS`           | Fail-closed model allow-list                                        |
| `assertApprovedModel`       | Throws `AI_MODEL_NOT_APPROVED` for unknown ids                      |
| `requireZeroRetentionModel` | Phase 10 clinical gate (`zeroRetention: true`)                      |
| `editorAssist`              | Streaming improve / shorten / fix_grammar / translate for marketing |
| `translateMessages`         | Batch-translate nested message trees into `*.draft.json` catalogs   |

## Editor assist

Pinned by `AI_GATEWAY_MODEL_EDITOR` (must be on the allow-list). Auth uses
`AI_GATEWAY_API_KEY` or Vercel OIDC. Context `"clinical"` is rejected until
Phase 10. HTTP surface: `POST /ai/editor` in `apps/api`.

## i18n drafts

`pnpm i18n:draft` finds keys present in `en` but missing from other required
locales (and not already in an existing draft), calls `translateMessages`, and
writes `apps/<app>/messages/<locale>.draft.json` as
`{ generatedAt, messages }`. Re-runs merge new keys and preserve
`generatedAt` / human edits. Humans review and promote keys into canonical
files. `pnpm check:i18n-parity` ignores draft keys for parity and fails if
`generatedAt` is older than 14 days (not filesystem mtime). Glossary SSOT:
`packages/config/glossary.json` (fixed terms: members, Space, expert, Eleva).

## Boundary

Import `ai` / `@ai-sdk/*` only inside this package. Apps and other packages
call `@eleva/ai`.
