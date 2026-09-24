# `@eleva/ai`

Vercel AI Gateway client and allow-listed model contracts (ADR-023).

## Exports

| Export                      | Use                                                                 |
| --------------------------- | ------------------------------------------------------------------- |
| `APPROVED_MODELS`           | Fail-closed model allow-list                                        |
| `assertApprovedModel`       | Throws `AI_MODEL_NOT_APPROVED` for unknown ids                      |
| `requireZeroRetentionModel` | Phase 10 clinical gate (`zeroRetention: true`)                      |
| `editorAssist`              | Streaming improve / shorten / fix_grammar / translate for marketing |

## Editor assist

Pinned by `AI_GATEWAY_MODEL_EDITOR` (must be on the allow-list). Auth uses
`AI_GATEWAY_API_KEY` or Vercel OIDC. Context `"clinical"` is rejected until
Phase 10. HTTP surface: `POST /ai/editor` in `apps/api`.

## Boundary

Import `ai` / `@ai-sdk/*` only inside this package. Apps and other packages
call `@eleva/ai`.
