## Architecture Principles

- **API-first**: All mutating business logic must be callable via HTTP endpoints in `apps/api`. Server Actions in frontend apps are thin proxies that validate UI input and delegate to domain package functions (e.g. `@eleva/auth` provisioning) or the API. Never put business logic only reachable from a Server Action.
- **Agentic-first**: Every API endpoint must be usable by AI agents and external services, not just browser UIs. This means: Bearer token auth alongside session auth, JSON request/response (no form-data-only), deterministic error codes, and discoverable via OpenAPI spec at `GET /openapi.json`.
- **Secure by default**: Every route handler must explicitly declare its auth model. No unauthenticated mutations. Rate limiting required on all non-internal routes (`@upstash/ratelimit` via `apps/api/src/lib/rate-limit.ts`). Zod validation required for all request bodies. See `.cursor/rules/api-first-agentic.mdc`.
- **BotID on public routes**: Any public-facing POST that creates resources or triggers side effects must use Vercel BotID (`apps/api/src/lib/bot-protection.ts`). Agent/M2M routes skip BotID (they authenticate via API key).
- **Domain packages own logic**: `@eleva/auth` owns user/org/membership provisioning and WorkOS interactions. `@eleva/db` owns schema and query helpers. Apps and API routes are thin orchestration layers.
- **No direct DB writes in frontend apps**: Frontend apps (`apps/account`, `apps/app`, `apps/admin`, `apps/expert`) should not import `db()` or `main.*` from `@eleva/db` directly for writes. Use `@eleva/db` query helpers for reads in Server Components, and call domain package functions or `apps/api` for writes.
- **Documented by default**: Every new API endpoint must have its Zod schemas registered in the OpenAPI spec. The spec is the single source of truth for both runtime validation and docs generation.
- **Audit by default**: Every mutating API endpoint and domain function MUST wrap its writes in `withAudit()` from `@eleva/audit`. This inserts an `audit_outbox` row atomically with domain data. The drainer ships rows to the append-only `audit_events` table in the separate audit Neon project. See `.cursor/rules/audit-wiring.mdc` and `packages/audit/README.md`.

## Learned User Preferences

- All HTTP API endpoints (`route.ts`) must live in `apps/api`. Never create API routes in `apps/web` or `apps/app`. Server Actions (`"use server"`) are fine in any app.

## Learned Workspace Facts

- `docs/eleva-v3/` is the workspace area for Eleva v3 architecture, specs, and ADR-style planning docs.
- `_context/clone-repo/` stores monorepo-tracked reference snapshots such as `eleva-care-app`, `cal.diy`, and `next-forge`, with nested `.git` directories removed so they are kept as plain files.
- `@eleva/storage` owns ALL `@vercel/blob` access. Boundary lint forbids direct `@vercel/blob` imports outside this package. Entrypoints: `blob-upload-handler` (server), `blob-upload-client` (client).
- Two Vercel Blob stores: **public** (`BLOB_READ_WRITE_TOKEN`) for avatars and marketing assets, **private** (`BLOB_PRIVATE_READ_WRITE_TOKEN`) for expert documents, patient reports, and PHI. Never store patient/health data in the public store. See `.cursor/rules/blob-storage.mdc` for details.
- Shared dependency versions are managed via **pnpm Catalog** in `pnpm-workspace.yaml`. When adding or bumping a cataloged dependency, edit the `catalog:` section in `pnpm-workspace.yaml` and use `"catalog:"` as the version in `package.json`. Never hardcode semver ranges for cataloged packages. See `.cursor/rules/pnpm-catalog.mdc` for the full protocol.
- `@eleva/api-client` is the typed HTTP client for consuming `apps/api`. All apps and scripts should use it instead of ad-hoc `fetch`. Schemas are shared between client and server via Zod.
- `apps/docs` will host Fumadocs-powered API reference at `/docs/api-reference`, auto-generated from the OpenAPI spec. Hand-written guides go in MDX under `/docs/guides`.
- `@eleva/audit` owns the transactional outbox pattern. `withAudit(options, fn)` wraps domain writes; `fn` receives a Drizzle `tx` and must call `ctx.emit({ entity, action, entityId, payload })`. Entity/action values are closed unions in `packages/audit/src/types.ts` — extend them when adding new auditable operations. The drainer runs via `POST /workflows/audit-outbox-drainer` on a QStash schedule (twice daily).
- Stripe webhook events follow a **two-file contract**: the dispatcher (`packages/billing/src/server/webhook.ts`, exposed via `POST /webhooks/stripe` route) and the setup script (`infra/stripe/setup-webhooks.ts`). When adding or removing webhook events, update **both** files and re-run `pnpm stripe:setup:webhooks -- --url <ENDPOINT_URL> --apply`. See `.cursor/rules/stripe-webhooks.mdc` and `.cursor/skills/stripe-webhooks/SKILL.md`.
