# ADR-014: Multi-Zone Rewrites For A Single Public Domain

## Status

Accepted

## Date

2026-04-22 (original), **revised 2026-04-22** to align with the vercel.com / resend.com pattern (app-at-root + API on subdomain), **revised 2026-05-22** to org-slug dispatch via gateway `proxy.ts` (see [ADR-015](./ADR-015-multi-app-split.md)).

## History

- **2026-04-22 original**: proposed `/app`, `/api`, `/docs` all as zone-rewrite prefixes on `eleva.care`.
- **2026-04-22 revision**: kept `/docs` on the root, moved all APIs to `api.eleva.care` subdomain, dropped the `/app` path prefix so authenticated routes live directly at the root (`eleva.care/patient`, `/expert`, `/org`, `/admin`, `/settings`). Matches vercel.com / resend.com / linear.app. Rationale: clearer SaaS URLs, cleaner separation of concerns for the API, no `/app` clutter.
- **2026-05-22 revision (current)**: superseded the fixed-segment product routes (`/patient`, `/expert`, `/org`) with **org-slug routing** (`eleva.care/[orgSlug]`, `eleva.care/[orgSlug]/expert/*`, …). Auth flows moved to `apps/account` (`/login`, `/dashboard`, …). Platform admin moved to `admin.eleva.care`. **All dynamic routing lives in `apps/web/src/proxy.ts`** via `@eleva/config/dispatch` — `next.config.mjs` only carries dev static-asset rewrites (`/_app`, `/_docs`, …). See [gateway-audit.md](../gateway-audit.md).

## Context

Eleva v3 ships multiple distinct surfaces (public marketing + marketplace, authenticated product, external-facing API/webhooks, documentation). Re-evaluated with three realities in mind:

1. The public marketing + the authenticated product serve the same brand; users move between them constantly. Cross-subdomain navigation ("am I still on Eleva?") fragments trust and SEO authority.
2. A proven pattern exists in the eulabel.eu monorepo (see [\_context/clone-repo/](_context/clone-repo/)) and is documented end-to-end in [\_context/blueprints/multi-zone-monorepo.md](_context/blueprints/multi-zone-monorepo.md). It is vercel.com's own pattern.
3. Vercel manages DNS for `eleva.care` (ADR-012), so rewrites, wildcard SSL, and per-PR preview wildcards are first-class operations.
4. APIs (external webhooks, OAuth callbacks, session-aware endpoints) benefit from **separation of concerns**: they're dev-only surfaces, never browsed by humans, and a clean subdomain is easier to reason about than fighting path-prefix collisions with the product's user-facing URLs.

The goal: one canonical public URL surface (`eleva.care`) for everything humans see; one dedicated subdomain (`api.eleva.care`) for everything servers call.

## Decision

Adopt the **multi-zone rewrite** architecture with four rules:

1. **`apps/web` is the gateway** for `eleva.care`. It serves marketing + marketplace + public profiles + booking funnel, runs `src/proxy.ts` for all dynamic dispatch, and uses `next.config.mjs` **only** for dev static-asset rewrites (`/_app`, `/_account`, `/_docs`, … → sibling localhost ports).
2. **Product surfaces use org-slug URLs on the root domain.** Member dashboard at `/[orgSlug]`, expert at `/[orgSlug]/expert/*`, team at `/[orgSlug]/team/*`, academy at `/[orgSlug]/academy/*`, org settings at `/[orgSlug]/settings`. Each satellite app runs without a public `basePath`; the gateway rewrites (prod) or redirects (local dev) to the correct origin.
3. **Auth and account settings live in `apps/account`**, proxied at `/login`, `/signup`, `/callback`, `/logout`, `/dashboard`, `/onboarding/*`, `/account/*`.
4. **APIs live on `api.eleva.care`.** Separate subdomain for external webhooks, OAuth callbacks, and session-aware server endpoints. Platform admin lives on **`admin.eleva.care`** (not root `/admin/*` — root `/admin` 302-redirects to the admin subdomain for bookmark compatibility).

### Zone map

| App                                                                      | Vercel project      | basePath          | Where it serves                                                         | Public URL examples                                                                                                                       |
| ------------------------------------------------------------------------ | ------------------- | ----------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway (marketing + marketplace + public profiles + booking + dispatch) | `elevacare-web`     | `/`               | `eleva.care/` root                                                      | `eleva.care/`, `eleva.care/home`, `eleva.care/about`, `eleva.care/legal/*`, `eleva.care/[username]`, `eleva.care/[username]/[event-slug]` |
| Member dashboard                                                         | `elevacare-app`     | `/` (no basePath) | `eleva.care/[orgSlug]` and `/[orgSlug]/settings` via gateway proxy      | `eleva.care/rodrigos-space`, `eleva.care/clinica-mota/settings`                                                                           |
| Expert workspace                                                         | `elevacare-expert`  | `/` (no basePath) | `eleva.care/[orgSlug]/expert/*` via gateway proxy                       | `eleva.care/rodrigo-pt/expert/schedule`                                                                                                   |
| Team workspace                                                           | `elevacare-team`    | `/` (no basePath) | `eleva.care/[orgSlug]/team/*` via gateway proxy                         | `eleva.care/baronas-clinica/team/members`                                                                                                 |
| Account (auth + settings hub)                                            | `elevacare-account` | `/` (no basePath) | `/login`, `/dashboard`, `/onboarding/*`, `/account/*` via gateway proxy | `eleva.care/login`, `eleva.care/account/settings`                                                                                         |
| Docs                                                                     | `elevacare-docs`    | `/docs`           | `eleva.care/docs/*` via gateway proxy                                   | `eleva.care/docs/compliance/portugal`                                                                                                     |
| Platform admin                                                           | `elevacare-admin`   | `/` (no basePath) | `admin.eleva.care/*` — own subdomain; root `/admin/*` redirects here    | `admin.eleva.care/payments`                                                                                                               |
| API + webhooks + OAuth callbacks + session-aware server endpoints        | `elevacare-api`     | `/` (no basePath) | `api.eleva.care/*` — separate subdomain, NOT rewritten from gateway     | `api.eleva.care/webhooks/stripe`, `api.eleva.care/stripe/account-session`                                                                 |
| Email preview tool (internal only)                                       | `elevacare-email`   | `/`               | `email.eleva.care` internal subdomain; not exposed publicly             | dev-only                                                                                                                                  |

Third-party-hosted subdomains (not Vercel projects):

- `status.eleva.care` → BetterStack public status page
- `sessions.eleva.care` → Daily.co branded video rooms (CNAME)

### Why API on subdomain, not under `/api`

- **Separation of concerns.** The MVP had `eleva.care/api/*` and the boundary kept leaking — public route collisions, accidental indexing of API error pages, confusing proxy rules. A subdomain is a hard boundary.
- **No path-prefix competition** with the root-namespaced usernames (`eleva.care/patimota`). Removing the `/api` prefix frees one more top-level path segment.
- **Ops clarity.** `api.eleva.care` is an engineering surface: webhooks, OAuth, server endpoints. It's fine (even desirable) for it to look like a separate host.
- **CORS with credentials is trivial** when both hosts are under `.eleva.care`. Cookies scoped to `.eleva.care`, `Access-Control-Allow-Origin: https://eleva.care`, `Access-Control-Allow-Credentials: true`. Stripe AccountSession and any other session-aware endpoint works cleanly.

### Gateway dispatch (current — not `next.config` path rewrites)

Dynamic routing is implemented in [`apps/web/src/proxy.ts`](../../../apps/web/src/proxy.ts) using pure path logic in [`packages/config/src/dispatch.ts`](../../../packages/config/src/dispatch.ts). Production uses `NextResponse.rewrite()` to satellite origins (`APP_ASSET_PREFIX`, etc.); local dev **redirects** to sibling localhost ports so each zone is debuggable independently.

`next.config.mjs` carries **only** dev static-asset rewrites via [`resolveGatewayStaticAssetRewrites()`](../../../packages/config/src/next-dev.mjs) (`beforeFiles`: `/_app/*`, `/_account/*`, `/_docs/*`, …).

Dispatch priority (first match wins — see `resolveDispatch()`):

1. Locale roots (`/pt`, `/es`, `/en`) → marketing (next-intl)
2. Marketing segments (`/about`, `/pricing`, `/home`, …) → marketing
3. `/docs/*` → docs zone
4. `/admin/*` → 302 redirect to `admin.eleva.care` (strip `/admin` prefix)
5. `/onboarding/*`, `/account/*`, `/login`, `/dashboard`, … → account zone
6. `/[orgSlug]/expert|team|academy|settings/*` → respective satellite app
7. `/[orgSlug]` with session → member app; without session → `/login?returnTo=…`
8. Bare `/` with session + document navigation → `/dashboard` or last active org
9. Fallback → next-intl marketing

Proxy orchestration stays under ~60 LOC; business logic lives in `@eleva/config/dispatch`, `@eleva/auth/proxy`, and `@eleva/observability/proxy`. See [gateway-audit.md](../gateway-audit.md).

### Legacy sketch (superseded 2026-05-22)

The `afterFiles` rewrite block below described the pre-org-slug model. **Do not implement** — kept for historical context only.

```js
// SUPERSEDED — see resolveDispatch() instead
const appUrl = process.env.APP_URL || "http://localhost:3001"
const docsUrl = process.env.DOCS_URL || "http://localhost:3008"
```

### Cookie scope

WorkOS session cookie is set on `.eleva.care` so it's readable from `eleva.care` (any zone) and from `api.eleva.care`. Gateway → app-zone calls are same-origin (no CORS). Gateway → `api.eleva.care` calls are cross-origin with credentials + CORS.

### CORS on `api.eleva.care`

```
Access-Control-Allow-Origin: https://eleva.care (exact match, not wildcard)
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: authorization, content-type, x-correlation-id
Access-Control-Max-Age: 86400
```

In staging, also allow `https://staging.eleva.care`. In preview, allow the specific `*.preview.eleva.care` host per request.

### CSP

Gateway CSP:

- `connect-src 'self' https://api.eleva.care https://js.stripe.com https://api.stripe.com https://m.stripe.com` — allow the app's cross-origin calls to the API subdomain
- `frame-src https://js.stripe.com https://connect-js.stripe.com https://*.stripe.com https://*.daily.co` — Stripe Embedded Components + Daily video
- `script-src 'self' https://js.stripe.com https://connect-js.stripe.com`
- `img-src 'self' data: https:` — marketplace avatars + Stripe assets

### Context-sensitive root behavior

| State           | `eleva.care/`                                                                                      | `eleva.care/home`                     | `eleva.care/pt` (locale root)               |
| --------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------- |
| Unauthenticated | marketing home (apps/web)                                                                          | marketing home (same content)         | marketing home via next-intl                |
| Authenticated   | **302 redirect** to `/dashboard` or last active org (`/[orgSlug]`) on **document navigation only** | marketing home (always; escape hatch) | marketing home — **no redirect** (RSC-safe) |

Redirect (not rewrite) on authenticated bare `/` because bookmarkability matters. Locale roots (`/pt`, `/es`) and App Router RSC fetches must **not** redirect — redirects break client-side `Link` navigation (`Failed to fetch RSC payload`).

### Customer custom domains (phase 2, white-label)

The multi-zone pattern leaves room for clinics to attach their own custom domain to a tenant-scoped zone (e.g., `clinica-mota.pt` → routes to `elevacare-app` with the org resolved from hostname). Not needed at launch.

## Alternatives Considered

### Option A — Public subdomains per app (`app.eleva.care`, `api.eleva.care`, `docs.eleva.care`)

- Pros: clean separation across all surfaces
- Cons: human-facing cross-subdomain navigation fragments trust and SEO. Product + marketing should live on one hostname.

### Option B — `/app` and `/api` as path-prefix zones under `eleva.care`

(This was the original ADR-014.)

- Pros: everything under one hostname, no CORS for API
- Cons: `/api` collides with public namespace and tempts accidental indexing (lesson from MVP); `/app` adds ugly clutter to every authenticated URL compared to the vercel.com / resend.com convention

### Option C — Single app, route groups

- Pros: simplest architecture
- Cons: cannot deploy, test, or scale product vs marketing independently; shared release cadence; defeats the monorepo value

### Option D — Org-slug apps on root + API/admin on subdomain + docs at `/docs` (chosen)

- Pros: clean SaaS URLs (`eleva.care/clinica-mota/expert`, not role-prefixed paths); API and admin hard boundaries on subdomains; `/docs` stays on root for SEO; single-domain cookie scope for gateway + product zones; trivial CORS to `api.eleva.care`
- Cons: reserved-slug list must block org names that collide with gateway segments; proxy dispatch must distinguish RSC fetches from document navigations

## Consequences

### Reserved-paths list grows

Gateway root now owns fixed first-segment paths and org-scoped second segments. Reserved list must include at minimum:

- Account: `dashboard`, `login`, `signup`, `callback`, `logout`, `onboarding`, `account`
- Org-scoped segments (never valid as org slug second segment alone): `expert`, `team`, `academy`, `settings`
- Gateway-fixed: `admin`, `docs`
- Marketing: `home`, `about`, `legal`, `help`, `blog`, `pricing`
- System: `_next`, `_vercel`, `api`, `trpc`, metadata convention routes
- Locale codes: `pt`, `es`, `en`, `br`

Maintained in [`@eleva/config/routing.ts`](../../../packages/config/src/routing.ts), [`@eleva/config/reserved-usernames.ts`](../../../packages/config/src/reserved-usernames.ts), and enforced at signup + Drizzle CHECK. See [identity-rbac-spec.md](../identity-rbac-spec.md).

### URL migration consequences

- Every webhook URL moves to `api.eleva.care/...`: Stripe, Daily, Resend, WorkOS, Google Calendar, Microsoft Calendar, TOConline, Moloni, etc.
- Stripe AccountSession moves to `api.eleva.care/stripe/account-session` (session-aware via cookie + CORS).
- Short URLs `eleva.care/[username]` and `eleva.care/[username]/[event-slug]` stay.
- `/docs/*` stays.

### Internal subdomains serve `noindex` / 301

`elevacare-app.vercel.app`, `elevacare-docs.vercel.app`, etc. either 301-redirect to `eleva.care/...` or serve `X-Robots-Tag: noindex` + `robots.txt` disallow. `api.eleva.care` is indexed by nobody (no HTML); add `robots.txt` disallow for safety.

### Per-PR previews

`*.preview.eleva.care` wildcard; preview env vars point `APP_URL`, `DOCS_URL`, `API_URL` at sibling preview deployments.

### Proxy file shape

Gateway `src/proxy.ts` delegates to `createGatewayProxy()` in [`apps/web/src/lib/create-gateway-proxy.ts`](../../../apps/web/src/lib/create-gateway-proxy.ts):

```ts
import createMiddleware from "next-intl/middleware"
import { createGatewayProxy } from "./lib/create-gateway-proxy"
import { routing } from "./i18n/routing"

export default createGatewayProxy({
  intlMiddleware: createMiddleware(routing),
})
```

The factory calls `resolveDispatch()` from `@eleva/config/dispatch`, then applies rewrite, login redirect, admin redirect, or root redirect as appropriate. Integration tests live in [`apps/web/src/proxy.test.ts`](../../../apps/web/src/proxy.test.ts).

## Related Docs

- [gateway-audit.md](../gateway-audit.md) — live gateway audit (2026-05-22)
- [ADR-015-multi-app-split.md](./ADR-015-multi-app-split.md) — org-slug micro-app topology
- [ADR-001-app-topology.md](./ADR-001-app-topology.md) — one authenticated product app; multi-zone serves that app
- [ADR-003-tenancy-and-rls.md](./ADR-003-tenancy-and-rls.md) — audit outbox pattern (writes from any zone)
- [ADR-008-feature-flags.md](./ADR-008-feature-flags.md) — Edge Config kill-switches
- [ADR-011-observability.md](./ADR-011-observability.md) — correlation ID across zones + subdomain
- [environment-matrix.md](../environment-matrix.md) — full URL + callback matrix
- [monorepo-structure.md](../monorepo-structure.md) — gateway vs sub-app layout
- [identity-rbac-spec.md](../identity-rbac-spec.md) — reserved-paths list
