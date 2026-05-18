# ADR: API-First, Agentic-First, and Secure Architecture

**Status**: Accepted  
**Date**: 2026-05-18  
**Authors**: Engineering team

## Context

The Eleva Care monorepo started with Server Actions directly writing to the database from frontend apps. As we prepare for AI agent integration, CLI tooling, and third-party service consumption, we need all mutating business logic to be callable via HTTP endpoints -- not locked behind Server Actions that only work from Next.js form submissions.

Additionally, a security audit revealed gaps: no centralized auth middleware, no rate limiting, no security headers on API responses, and an unauthenticated fallback on the audit-outbox-drainer endpoint.

## Decision

We adopt an **API-first, agentic-first, and secure-by-default** architecture.

### Core Principles

1. **API-first**: All mutating business logic is callable via HTTP in `apps/api`. Server Actions in frontend apps are thin proxies.
2. **Agentic-first**: Every endpoint supports dual auth (session + Bearer), returns JSON, uses deterministic error codes, and is discoverable via OpenAPI spec.
3. **Secure by default**: Every route handler explicitly declares its auth model. No unauthenticated mutations. Rate limiting and Zod validation required.
4. **BotID on public routes**: Public-facing POSTs that create resources use Vercel BotID.
5. **Domain packages own logic**: `@eleva/auth` owns provisioning. `@eleva/db` owns queries. Apps are thin layers.
6. **Documented by default**: Every endpoint has Zod schemas registered in the OpenAPI spec.

### Authentication Model

Dual auth via `resolveApiAuth()`:

| Auth type      | Use case                | Mechanism                                              |
| -------------- | ----------------------- | ------------------------------------------------------ |
| Session cookie | Browser apps            | WorkOS AuthKit `wos-session` cookie                    |
| Bearer API key | AI agents, CLI          | `Authorization: Bearer elk_...` validated via WorkOS   |
| Bearer M2M JWT | Service-to-service      | `Authorization: Bearer <jwt>` verified via WorkOS JWKS |
| Secret header  | Internal (cron, QStash) | `Authorization: Bearer ${CRON_SECRET}`                 |

### Security Layers

| Layer            | Implementation                      | Location                                  |
| ---------------- | ----------------------------------- | ----------------------------------------- |
| Auth             | `requireApiAuth()`                  | `apps/api/src/lib/auth.ts`                |
| Rate limiting    | `@upstash/ratelimit` sliding window | `apps/api/src/lib/rate-limit.ts`          |
| Bot protection   | Vercel BotID                        | `apps/api/src/lib/bot-protection.ts`      |
| Validation       | Zod schemas                         | Per-route, shared via `@eleva/api-client` |
| Security headers | HSTS, X-Content-Type-Options, etc.  | `apps/api/src/lib/security-headers.ts`    |
| CORS             | Strict origin matcher               | `apps/api/src/lib/cors.ts`                |

### Rate Limit Tiers

| Category                | Limit      | Key                 |
| ----------------------- | ---------- | ------------------- |
| Authenticated mutations | 60 req/min | `user:<userId>`     |
| Public endpoints        | 10 req/min | `ip:<address>`      |
| Onboarding              | 5 req/min  | `ip:<address>`      |
| Internal (cron, QStash) | No limit   | Protected by secret |

### Error Format

All errors return JSON: `{ error: string, issues?: ZodIssue[], message?: string }` with HTTP status codes 401, 403, 404, 422, 429, 500.

### OpenAPI & Documentation

- OpenAPI 3.1 spec generated from Zod schemas via `zod-openapi` v5
- Served at `GET /openapi.json` (public, CDN-cached)
- Future: Fumadocs-powered API reference at `/docs/api-reference`
- Single source of truth: one Zod schema -> runtime validation + TypeScript types + OpenAPI spec

## Alternatives Considered

### tRPC

Considered for type-safe RPC, but rejected because:

- Not HTTP-standard (custom protocol over HTTP POST)
- Not consumable by arbitrary HTTP clients (AI agents, curl, Postman)
- Vendor lock-in to the tRPC ecosystem

### GraphQL

Considered for flexible querying, but rejected because:

- Complexity overhead for our use case
- Harder to rate-limit per operation
- Auth patterns are less standardized
- Overkill when most operations are CRUD

### Keep Server Actions only

Rejected because:

- Not callable by AI agents or CLI tools
- No standard auth beyond cookies
- Business logic locked in Next.js-specific Server Action format

## Consequences

### Positive

- AI agents can discover and call all APIs via OpenAPI spec
- Consistent security posture across all endpoints
- Domain logic is testable independently of Next.js
- Clear separation: apps = orchestration, packages = logic

### Negative

- Additional HTTP hop for Server Actions that now proxy to API
- More files to maintain (route handlers + domain functions + client schemas)
- Rate limit infrastructure requires Upstash Redis

### Migration Path

| Priority | Target                                  | Status                                                   |
| -------- | --------------------------------------- | -------------------------------------------------------- |
| P0       | `apps/account/onboarding/actions.ts`    | **Done** -- refactored to use `@eleva/auth` provisioning |
| P0       | `apps/api` security hardening           | **Done** -- auth, rate limiting, headers, drainer fix    |
| P1       | `apps/account/profile/actions.ts`       | Pending -- wire avatar through API                       |
| P1       | `apps/admin/become-partner/actions.ts`  | Pending -- when agents need it                           |
| P2       | `apps/expert` Server Actions (4 files)  | Pending -- when agents need expert management            |
| OK       | `apps/expert` Server Components (reads) | No change needed -- `@eleva/db` helpers for SSR          |

## References

- `AGENTS.md` -- architecture principles
- `.cursor/rules/api-first-agentic.mdc` -- Cursor rule enforcing patterns
- `.cursor/skills/api-first-agentic/SKILL.md` -- step-by-step guide for developers
- `apps/api/src/lib/openapi.ts` -- OpenAPI spec registration
- `packages/api-client/src/index.ts` -- typed client + shared Zod schemas
- `packages/auth/src/provisioning.ts` -- domain provisioning functions
