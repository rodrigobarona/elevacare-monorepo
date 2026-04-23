# ADR-014: Multi-Zone Rewrites For A Single Public Domain

## Status

Accepted

## Date

2026-04-22 (original), **revised 2026-04-22** to align with the vercel.com / resend.com pattern (app-at-root + API on subdomain).

## History

- **2026-04-22 original**: proposed `/app`, `/api`, `/docs` all as zone-rewrite prefixes on `eleva.care`.
- **2026-04-22 revision**: kept `/docs` on the root, moved all APIs to `api.eleva.care` subdomain, dropped the `/app` path prefix so authenticated routes live directly at the root (`eleva.care/patient`, `/expert`, `/org`, `/admin`, `/settings`). Matches vercel.com / resend.com / linear.app. Rationale: clearer SaaS URLs, cleaner separation of concerns for the API, no `/app` clutter.

## Context

Eleva v3 ships multiple distinct surfaces (public marketing + marketplace, authenticated product, external-facing API/webhooks, documentation). Re-evaluated with three realities in mind:

1. The public marketing + the authenticated product serve the same brand; users move between them constantly. Cross-subdomain navigation ("am I still on Eleva?") fragments trust and SEO authority.
2. A proven pattern exists in the eulabel.eu monorepo (see [_context/clone-repo/](_context/clone-repo/)) and is documented end-to-end in [_context/blueprints/multi-zone-monorepo.md](_context/blueprints/multi-zone-monorepo.md). It is vercel.com's own pattern.
3. Vercel manages DNS for `eleva.care` (ADR-012), so rewrites, wildcard SSL, and per-PR preview wildcards are first-class operations.
4. APIs (external webhooks, OAuth callbacks, session-aware endpoints) benefit from **separation of concerns**: they're dev-only surfaces, never browsed by humans, and a clean subdomain is easier to reason about than fighting path-prefix collisions with the product's user-facing URLs.

The goal: one canonical public URL surface (`eleva.care`) for everything humans see; one dedicated subdomain (`api.eleva.care`) for everything servers call.

## Decision

Adopt the **multi-zone rewrite** architecture with three rules:

1. **`apps/web` is the gateway** for `eleva.care`. It serves marketing + marketplace + public profiles + booking funnel, carries rewrites in `next.config.mjs`, and runs `src/proxy.ts` for context-sensitive root routing.
2. **`apps/app` runs at the root.** Authenticated routes — `/patient`, `/expert`, `/org`, `/admin`, `/settings`, `/callback`, `/logout` — live at the top level, rewritten individually from the gateway. No `/app` prefix. This matches vercel.com (`/dashboard`, `/settings`) and resend.com (`/emails`, `/domains`).
3. **APIs live on `api.eleva.care`.** Separate subdomain for all external webhooks, OAuth callbacks, and session-aware server endpoints. `.eleva.care` cookie scope + CORS make session-aware calls from the gateway/app work cross-origin with credentials. Stripe AccountSession lives here.

### Zone map

| App | Vercel project | basePath | Where it serves | Public URL examples |
| --- | -------------- | -------- | --------------- | -------------------- |
| Gateway (marketing + marketplace + public profiles + booking + auth root routing) | `elevacare-marketing` | `/` | `eleva.care/` root | `eleva.care/`, `eleva.care/home`, `eleva.care/about`, `eleva.care/legal/*`, `eleva.care/experts`, `eleva.care/become-partner`, `eleva.care/clinics`, `eleva.care/[username]`, `eleva.care/[username]/[event-slug]` |
| Authenticated product | `elevacare-app` | `/` (no basePath) | `eleva.care/patient`, `/expert`, `/org`, `/admin`, `/settings`, `/callback`, `/logout` — rewritten individually from gateway | `eleva.care/patient`, `eleva.care/expert/finance`, `eleva.care/org/billing`, `eleva.care/admin/become-partner` |
| Docs | `elevacare-docs` | `/docs` | `eleva.care/docs/*` via multi-zone rewrite | `eleva.care/docs/compliance/portugal` |
| API + webhooks + OAuth callbacks + session-aware server endpoints | `elevacare-api` | `/` (no basePath) | `api.eleva.care/*` — separate subdomain, NOT rewritten | `api.eleva.care/stripe/webhook`, `api.eleva.care/stripe/account-session`, `api.eleva.care/daily/transcripts`, `api.eleva.care/calendar/oauth/google/callback` |
| Email preview tool (internal only) | `elevacare-email` | `/` | `email.eleva.care` internal subdomain; not exposed publicly | dev-only |

Third-party-hosted subdomains (not Vercel projects):

- `status.eleva.care` → BetterStack public status page
- `sessions.eleva.care` → Daily.co branded video rooms (CNAME)

### Why API on subdomain, not under `/api`

- **Separation of concerns.** The MVP had `eleva.care/api/*` and the boundary kept leaking — public route collisions, accidental indexing of API error pages, confusing proxy rules. A subdomain is a hard boundary.
- **No path-prefix competition** with the root-namespaced usernames (`eleva.care/patimota`). Removing the `/api` prefix frees one more top-level path segment.
- **Ops clarity.** `api.eleva.care` is an engineering surface: webhooks, OAuth, server endpoints. It's fine (even desirable) for it to look like a separate host.
- **CORS with credentials is trivial** when both hosts are under `.eleva.care`. Cookies scoped to `.eleva.care`, `Access-Control-Allow-Origin: https://eleva.care`, `Access-Control-Allow-Credentials: true`. Stripe AccountSession and any other session-aware endpoint works cleanly.

### Rewrite config (sketch)

Lives in the gateway's `next.config.mjs`:

```js
const appUrl = process.env.APP_URL || 'http://localhost:3001';
const docsUrl = process.env.DOCS_URL || 'http://localhost:3003';

const nextConfig = {
  async rewrites() {
    return {
      afterFiles: [
        // Authenticated product at root (no /app prefix).
        { source: '/patient', destination: `${appUrl}/patient` },
        { source: '/patient/:path*', destination: `${appUrl}/patient/:path*` },
        { source: '/expert', destination: `${appUrl}/expert` },
        { source: '/expert/:path*', destination: `${appUrl}/expert/:path*` },
        { source: '/org', destination: `${appUrl}/org` },
        { source: '/org/:path*', destination: `${appUrl}/org/:path*` },
        { source: '/admin', destination: `${appUrl}/admin` },
        { source: '/admin/:path*', destination: `${appUrl}/admin/:path*` },
        { source: '/settings', destination: `${appUrl}/settings` },
        { source: '/settings/:path*', destination: `${appUrl}/settings/:path*` },
        { source: '/callback', destination: `${appUrl}/callback` },
        { source: '/logout', destination: `${appUrl}/logout` },

        // Docs zone.
        { source: '/docs', destination: `${docsUrl}/docs` },
        { source: '/docs/:path*', destination: `${docsUrl}/docs/:path*` },

        // API lives on api.eleva.care (separate subdomain). Not rewritten here.
      ],
    };
  },
};

export default nextConfig;
```

Notes:

- `afterFiles` (not `beforeFiles`) so rewrites only fire when the gateway has no local route.
- `apps/app` has **no `basePath`** — it runs at its own internal root (`elevacare-app.vercel.app/patient`, etc.). The gateway targets these root paths directly.
- `apps/docs` keeps `basePath: '/docs'` so internal routing aligns with the public prefix.
- `apps/api` has no `basePath` and is served on `api.eleva.care` without rewrites from the gateway.

### Proxy priority (gateway `src/proxy.ts`)

Fixed priority ladder — first rule that matches wins:

1. **Pass-through for `afterFiles` rewrites**: `/patient`, `/expert`, `/org`, `/admin`, `/settings`, `/callback`, `/logout`, `/docs` → `NextResponse.next()` so Next.js resolves the rewrite.
2. **`/home` always serves marketing** (the escape hatch for logged-in users).
3. **Username-first public paths** (`/[username]`, `/[username]/[event-slug]`) resolved with i18n routing.
4. **Context-sensitive root**: `/` with a valid WorkOS session → 302 redirect to role home (`/patient` | `/expert` | `/org` | `/admin`). `/` without session → marketing home via `createMiddleware(i18nConfig)`.
5. **Fallback**: i18n for any other marketing path.

Proxy file stays under ~50 LOC. Business logic lives in owning packages (`@eleva/auth/proxy`, `@eleva/observability/proxy`, etc.). See [_context/blueprints/multi-zone-monorepo.md](../../../_context/blueprints/multi-zone-monorepo.md) for the reference pattern.

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

| State | `eleva.care/` | `eleva.care/home` |
| ----- | ------------- | ----------------- |
| Unauthenticated | marketing home (apps/web) | marketing home (same content) |
| Authenticated | **302 redirect** to role home (`/patient`, `/expert`, `/org`, or `/admin` based on JWT claim) | marketing home (always; escape hatch) |

Redirect (not rewrite) on authenticated `/` because bookmarkability matters (Vercel/Resend/Linear pattern). URL bar changes to the role home on visit.

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

### Option D — App at root + API on subdomain + docs at `/docs` (chosen)

- Pros: matches vercel.com / resend.com / linear.app convention; clean SaaS URLs (`eleva.care/patient`, not `eleva.care/app/patient`); API separation is a hard boundary (subdomain); `/docs` stays on the root domain for SEO authority; single-domain cookie scope preserved for gateway/app; trivial CORS to `api.eleva.care` because both under `.eleva.care`
- Cons: reserved-paths list grows (every authenticated route at root must be reserved against usernames); context-sensitive root logic needs careful proxy handling

## Consequences

### Reserved-paths list grows

Gateway root now owns every authenticated route as a first-segment path. Reserved list must include at minimum:

- Authenticated: `patient`, `expert`, `org`, `admin`, `settings`, `callback`, `logout`
- Marketing: `home`, `about`, `legal`, `privacy`, `terms`, `blog`, `experts`, `categories`, `become-partner`, `clinics`, `partners`, `careers`, `pricing`
- Docs: `docs`
- System: `auth`, `signin`, `signup`, `login`, `_next`, `_vercel`, `favicon.ico`, `robots.txt`, `sitemap.xml`
- Locale codes: `pt`, `es`, `en`, `br`
- Safe-keeping: `academy`, `courses`, `teams`, `help`, `support`, `faq`

**Removed** from the list: `app`, `api` (no longer gateway route prefixes).

Maintained in [`@eleva/config/reserved-usernames.ts`](../../../packages/config/src/reserved-usernames.ts) and enforced at signup, Drizzle CHECK constraint, and admin tooling. See [identity-rbac-spec.md](../identity-rbac-spec.md) for the authoritative list.

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

Gateway `src/proxy.ts` remains small:

```ts
import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { i18nConfig } from '@eleva/config/i18n';
import { hasSession, readRoleHome } from '@eleva/auth/proxy';

const intl = createMiddleware(i18nConfig);

const REWRITE_PREFIXES = [
  '/patient', '/expert', '/org', '/admin', '/settings',
  '/callback', '/logout', '/docs',
];

const startsWithAny = (p: string, list: string[]) =>
  list.some((x) => p === x || p.startsWith(x + '/'));

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Multi-zone rewrites handled by next.config
  if (startsWithAny(pathname, REWRITE_PREFIXES)) return NextResponse.next();

  // 2. /home always marketing (even for logged-in users)
  if (pathname === '/home' || pathname.startsWith('/home/')) return intl(req);

  // 3. Authenticated /root → role home
  if (pathname === '/' && hasSession(req)) {
    const roleHome = readRoleHome(req); // e.g. '/patient'
    return NextResponse.redirect(new URL(roleHome, req.url));
  }

  // 4. Fallback: marketing + public profile routes via i18n
  return intl(req);
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
```

## Related Docs

- [_context/blueprints/multi-zone-monorepo.md](../../../_context/blueprints/multi-zone-monorepo.md) — reference blueprint
- [ADR-001-app-topology.md](./ADR-001-app-topology.md) — one authenticated product app; multi-zone serves that app
- [ADR-003-tenancy-and-rls.md](./ADR-003-tenancy-and-rls.md) — audit outbox pattern (writes from any zone)
- [ADR-008-feature-flags.md](./ADR-008-feature-flags.md) — Edge Config kill-switches
- [ADR-011-observability.md](./ADR-011-observability.md) — correlation ID across zones + subdomain
- [environment-matrix.md](../environment-matrix.md) — full URL + callback matrix
- [monorepo-structure.md](../monorepo-structure.md) — gateway vs sub-app layout
- [identity-rbac-spec.md](../identity-rbac-spec.md) — reserved-paths list
