# ADR-014: Multi-Zone Rewrites For A Single Public Domain

## Status

Accepted

## Date

2026-04-22

## Context

Eleva v3 ships multiple distinct surfaces (public marketing + marketplace, authenticated product, external-facing API/webhooks, documentation). Earlier versions of the handbook split these across subdomains (`app.eleva.care`, `api.eleva.care`, `docs.eleva.care`). Re-evaluated with three realities in mind:

1. All four apps serve the same brand. Cross-subdomain navigation harms trust ("am I still on Eleva?"), requires cookie gymnastics (`.eleva.care` scope), and fragments SEO authority.
2. A proven pattern exists in the eulabel.eu monorepo (see [_context/clone-repo/](_context/clone-repo/) projects) and is documented end-to-end in [_context/blueprints/multi-zone-monorepo.md](_context/blueprints/multi-zone-monorepo.md). It is vercel.com's own pattern.
3. Vercel manages DNS for `eleva.care` (ADR-012 / decision log 2026-04-22), so rewrites, wildcard SSL, and per-PR preview wildcards are first-class operations.

The goal: a single canonical public URL surface — `eleva.care` — behind which multiple Vercel projects serve different path prefixes transparently.

## Decision

Adopt the **multi-zone rewrite** architecture. One gateway app owns the root domain and rewrites path prefixes to other Vercel projects.

- **Gateway**: `apps/web` (Vercel project `elevacare-marketing`) owns `eleva.care`.
  - Serves its own pages: marketing home, category pages, public expert profiles, public clinic profiles, booking funnel, legal/trust/blog.
  - Owns `src/proxy.ts` composing next-intl + auth + secure-headers + rewrite-passthrough.
  - Owns the rewrite config in `next.config.mjs`.
- **Sub-apps**: each lives on an internal Vercel project domain and is exposed under a path prefix on the gateway via multi-zone rewrites. Each sub-app declares `basePath` so its file-system routing matches its public prefix.

| App | Vercel project | basePath | Public URL |
| --- | --- | --- | --- |
| Gateway marketing + marketplace | `elevacare-marketing` | `/` | `eleva.care/` + `eleva.care/[username]` + `eleva.care/[username]/[event-slug]` + marketing paths |
| Authenticated product | `elevacare-app` | `/app` | `eleva.care/app/patient`, `/app/expert`, `/app/org`, `/app/admin` |
| External-facing API + OAuth callbacks + webhooks | `elevacare-api` | `/api` | `eleva.care/api/stripe/webhook`, `/api/daily/transcripts`, `/api/calendar/oauth/[provider]/callback`, `/api/accounting/toconline/callback`, etc. |
| Product docs + ERS PT compliance | `elevacare-docs` | `/docs` | `eleva.care/docs/compliance/portugal`, etc. |
| Email preview tool (internal only) | `elevacare-email` | none | `email.eleva.care` (internal subdomain, not rewritten) |

Third-party-hosted surfaces stay as subdomains (they're not Vercel projects):

- `status.eleva.care` → BetterStack public status page
- `sessions.eleva.care` → Daily.co branded video rooms (CNAME)

### Internal-subdomain canonicalization

Sub-app Vercel project URLs (`elevacare-app.vercel.app`, etc.) and any internal subdomain aliases are either:

- **301-redirected** to the canonical `eleva.care/...` URL via Vercel domain redirects, **or**
- served with `X-Robots-Tag: noindex` and an explicit `robots.txt` disallowing crawlers.

Only `eleva.care` appears in search engines. This protects SEO authority and avoids duplicate-content splits.

### Rewrite config (sketch)

Lives in the gateway's `next.config.mjs`:

```js
const apiUrl = process.env.API_URL || 'http://localhost:3002';
const appUrl = process.env.APP_URL || 'http://localhost:3001';
const docsUrl = process.env.DOCS_URL || 'http://localhost:3003';

const nextConfig = {
  async rewrites() {
    return {
      afterFiles: [
        { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
        { source: '/app', destination: `${appUrl}/app` },
        { source: '/app/:path*', destination: `${appUrl}/app/:path*` },
        { source: '/docs', destination: `${docsUrl}/docs` },
        { source: '/docs/:path*', destination: `${docsUrl}/docs/:path*` },
      ],
    };
  },
};
```

- `afterFiles` (not `beforeFiles`) because these rewrites only fire when the gateway has no local route for the path.
- Each sub-app's `basePath` matches the rewrite prefix so requests resolve cleanly inside that app.

### Proxy priority (gateway `src/proxy.ts`)

Fixed priority ladder — the first rule that matches wins. Order is:

1. Let `afterFiles` rewrites handle `/api/`, `/app/`, `/docs/` passthroughs (proxy returns `NextResponse.next()`)
2. Auth callback paths forwarded to the app zone
3. Marketing paths handled by `createMiddleware(i18nConfig)` with `localePrefix: 'as-needed'`
4. Authenticated marketplace paths (`/[username]`, `/[username]/[event]`) pass through with i18n
5. Session-aware fallback: `/` with a valid WorkOS session redirects to `/app/patient` (or the role-appropriate home)

Proxy file must stay under ~50 LOC. Business logic lives in owning packages (`@eleva/auth/proxy`, `@eleva/observability/proxy`, etc.).

### Cookie scope

WorkOS session cookie is set on `.eleva.care` so it's readable from every zone on the gateway and from any sub-app Vercel project (since the public hostname is always `eleva.care`). No CORS, no subdomain cookie tricks.

### CSP

CSP allows `js.stripe.com`, `connect-js.stripe.com`, `*.stripe.com` for Stripe Embedded Components; adds `*.daily.co` for video; allows `*.eleva.care` for zone-to-zone XHR during development only. Production XHR stays same-origin (`eleva.care`).

### Customer custom domains (phase 2, white-label)

The multi-zone pattern leaves room for clinics to attach their own custom domain to their clinic's public zone (e.g., `clinica-mota.pt` → `elevacare-app` with a tenant-scoped hostname). Not needed at launch; architecture does not block it.

## Alternatives Considered

### Option A — Public subdomains for each app (`app.eleva.care`, `api.eleva.care`, `docs.eleva.care`)

- Pros: clean app boundaries, simpler rewrites in deployment
- Cons: cross-subdomain cookie gymnastics; brand fragmentation; SEO splits; each subdomain needs its own SSL; two hostnames during patient→expert navigation

### Option B — Single app, route groups

- Pros: simplest architecture
- Cons: cannot independently deploy, test, or scale the authenticated product vs marketing; defeats the monorepo value; forces shared release cadence

### Option C — Multi-zone rewrites (chosen)

- Pros: one canonical brand URL; independent app deploys; shared session cookie scoped on `.eleva.care`; no CORS; matches vercel.com's own pattern and the battle-tested eulabel.eu implementation; SEO authority consolidated to `eleva.care`; white-label customer domains possible later
- Cons: gateway owns the rewrite config (one place to maintain); first-segment path namespace is shared (mitigated by a reserved-names list — see [identity-rbac-spec.md](../identity-rbac-spec.md))

## Consequences

- Every webhook URL is on `eleva.care/api/...` — Stripe, Daily, Resend, WorkOS, Google Calendar, Microsoft Calendar, TOConline all point at the same canonical domain
- Username-first public URLs (`eleva.care/patimota`) become possible because the gateway has full control of the root namespace — subject to a reserved-path list (`app`, `api`, `docs`, `about`, `legal`, etc.)
- AccountSession minting for Stripe Embedded Components runs at `eleva.care/app/api/stripe/account-session` — session-aware because it lives in the app zone
- Each sub-app's `basePath` must be declared correctly; a misconfigured `basePath` breaks all routes in that zone
- Internal Vercel URLs are operational-only (debugging, preview, CI) — never shared with users
- Per-PR preview wildcards on `*.preview.eleva.care` give review URLs on the canonical domain

## Related Docs

- [_context/blueprints/multi-zone-monorepo.md](../../../_context/blueprints/multi-zone-monorepo.md) — full blueprint with gateway, proxy, rewrites, and white-label guidance
- [ADR-001-app-topology.md](./ADR-001-app-topology.md) — one authenticated product app; multi-zone serves that app
- [ADR-008-feature-flags.md](./ADR-008-feature-flags.md) — Edge Config kill-switches for the gateway
- [ADR-011-observability.md](./ADR-011-observability.md) — correlation ID propagation across zones
- [environment-matrix.md](../environment-matrix.md) — full URL matrix and callback mapping
- [monorepo-structure.md](../monorepo-structure.md) — gateway vs sub-app layout
