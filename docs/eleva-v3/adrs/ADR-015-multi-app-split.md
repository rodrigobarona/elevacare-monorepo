# ADR-015: Multi-App Architecture Split

## Status

Accepted (supersedes ADR-001 topology decision; extends ADR-014 multi-zone rewrites)

## Date

2026-05-14

## Context

ADR-001 chose to start with one authenticated app (`apps/app`) and split later when justified. The product has since matured enough that the split is now justified:

- Expert tools (`[orgSlug]/expert/*`) are a large, self-contained surface with Stripe Connect, calendar integrations, and scheduling logic.
- Team management is a new product surface for `org_type: "team"`.
- Platform admin (`(admin)/*`) handles sensitive operations (application approvals, payouts, audit) that benefit from a hard security boundary.
- Account settings (profile, security, orgs, billing) are cross-cutting concerns that span all product surfaces.
- Academy (LMS) is a future product surface for lecturers to create and sell courses.
- The mobile Eleva Diary app will connect via the same WorkOS user pool.

The current single-app architecture makes it harder to:

- Deploy expert features independently of member features
- Enforce security boundaries for admin operations
- Scale team ownership as the product grows
- Keep build times fast as the app surface grows

### Vercel Microfrontends evaluation

Vercel Microfrontends was evaluated and rejected on cost grounds. All plans (Hobby, Pro, Enterprise) include only 2 microfrontend projects. Additional projects cost $250/project/month. With 5-6 apps, routing alone would cost $750-$1,000/month.

The existing custom proxy + rewrites pattern achieves the same result at zero additional cost. This is the same approach vercel.com used before productizing microfrontends. The path ownership model is identical, so migration to native microfrontends is straightforward if pricing changes.

## Decision

Split `apps/app` into focused micro-apps. Use two routing mechanisms:

1. **Gateway proxy rewrites** (via `apps/web`) for apps on the root domain `eleva.care`
2. **Independent subdomains** for apps that benefit from a hard boundary

### App topology

| App                                               | Repo path      | Public URL                                                    | Routing               | Port |
| ------------------------------------------------- | -------------- | ------------------------------------------------------------- | --------------------- | ---- |
| Gateway (marketing, marketplace, public profiles) | `apps/web`     | `eleva.care/*`                                                | Owns the domain       | 3000 |
| Member (dashboard)                                | `apps/app`     | `eleva.care/[orgSlug]`                                        | Gateway proxy rewrite | 3001 |
| API (webhooks, OAuth, server endpoints)           | `apps/api`     | `api.eleva.care/*`                                            | Own subdomain         | 3002 |
| Account (identity hub)                            | `apps/account` | `eleva.care/signin`, `/callback`, `/account/*`, `/onboarding` | Gateway proxy rewrite | 3006 |
| Expert (expert tools)                             | `apps/expert`  | `eleva.care/[orgSlug]/expert/*`                               | Gateway proxy rewrite | 3003 |
| Team (clinic management)                          | `apps/team`    | `eleva.care/[orgSlug]/team/*`                                 | Gateway proxy rewrite | 3004 |
| Academy (LMS, future)                             | `apps/academy` | `eleva.care/[orgSlug]/academy/*`                              | Gateway proxy rewrite | 3005 |
| Admin (platform operations)                       | `apps/admin`   | `admin.eleva.care/*`                                          | Own subdomain         | 3007 |

### Root domain apps (`eleva.care`)

The gateway (`apps/web`) dispatches requests to the correct app origin based on URL path segments:

- `/signin`, `/signup`, `/callback`, `/logout`, `/auth-redirect` -> `apps/account`
- `/onboarding/*`, `/account/*` -> `apps/account`
- `/[orgSlug]/expert/*` -> `apps/expert`
- `/[orgSlug]/team/*` -> `apps/team`
- `/[orgSlug]/academy/*` -> `apps/academy` (future)
- `/[orgSlug]` (bare) -> `apps/app` (member dashboard)
- Everything else -> `apps/web` (marketing)

The routing constants live in `@eleva/config/routing`:

```typescript
export const ORG_SCOPED_SEGMENTS = [
  "expert",
  "team",
  "academy",
  "settings",
] as const
```

Each app behind the gateway needs:

- `assetPrefix` from env (e.g., `EXPERT_ASSET_PREFIX`) so static assets route back to the correct origin
- `serverActions.allowedOrigins` including the gateway host so Server Actions work cross-origin

### Subdomain apps

Two apps live on their own subdomains, deployed as standalone Vercel projects:

- `admin.eleva.care` -- platform operations (hardest security boundary; can have stricter CSP, WAF rules, IP allowlists)
- `api.eleva.care` -- server endpoints (already exists)

All share the `.eleva.care` cookie scope for seamless WorkOS session sharing.

### Auth architecture

All apps share one WorkOS application and one `@eleva/auth` package.

Auth flows are centralized in `apps/account`, served via the gateway proxy at `eleva.care`:

- `/signin`, `/signup` -- redirect to WorkOS AuthKit
- `/callback` -- handle WorkOS callback, set session cookie on `.eleva.care`
- `/logout` -- clear session, redirect to `eleva.care`
- `/auth-redirect` -- post-login routing with `returnTo` support
- `/onboarding` -- create first personal org ("space")

Every other app's `proxy.ts` redirects unauthenticated users to `eleva.care/signin?returnTo={current-url}`. After the callback sets the `.eleva.care` cookie, the user is redirected back via `returnTo`.

### Organization model

Each user can have multiple orgs. The org type determines which app serves the product surface:

| Org type           | Product label           | App            | Example slug         |
| ------------------ | ----------------------- | -------------- | -------------------- |
| `personal`         | `member`                | `apps/app`     | `rodrigos-space`     |
| `expert`           | `expert`                | `apps/expert`  | `rodrigo-pt`         |
| `team`             | `team_admin` / `expert` | `apps/team`    | `baronas-clinica`    |
| `academy` (future) | `lecturer` (future)     | `apps/academy` | `learn-with-rodrigo` |
| `staff`            | `staff`                 | `apps/admin`   | N/A (subdomain)      |

The org switcher in the shared `AppShell` lists all user memberships and navigates to the appropriate org+app URL. Each org is its own "world" with its own sidebar navigation.

### Sidebar / shared shell

All apps import the same `AppShell` component from `@eleva/ui`. The sidebar is org-scoped (not app-scoped):

- When in a `personal` org: member nav (appointments, notes, reviews, courses)
- When in an `expert` org: expert nav (events, schedule, finance, calendars)
- When in a `team` org: team nav (members, billing, landing page)
- When in an `academy` org: lecturer nav (courses, analytics)

Cross-app navigations (org switching, account settings) trigger a full page reload but the shell looks identical because it's the same component. Within an app, navigation is instant (client-side).

### Academy (future)

The academy app is scaffolded but not yet active. Key design decisions:

- **Lecturer side** (creation): A member applies to become a lecturer and creates a new org (`org_type: "academy"`). Inside that org they access `/[orgSlug]/academy/*` to create courses, set prices, manage content, and view analytics.
- **Learner side** (consumption): Course progress, enrolled courses, and lesson completion live in the member dashboard (`apps/app`) under the personal org.
- New org type `"academy"` and product label `"lecturer"` will be added to `@eleva/auth` capabilities when the product takes shape.
- `packages/academy` should be created as a domain boundary before the app grows.

### Eleva Diary (mobile)

The Diary app connects via the same WorkOS user pool. WorkOS "Multiple Applications" gives Diary its own client ID, redirect URIs, and session policy while sharing users and organizations. Data sync goes through `api.eleva.care` endpoints. The member app (`apps/app`) displays Diary data.

## Alternatives considered

### Keep everything in one app (status quo)

Pros: simplest deployment, no cross-app concerns.

Cons: growing build times, no isolation for admin operations, harder to scale team ownership, monolithic release cadence.

Rejected because the product has reached the size where the split pays off.

### Vercel Microfrontends

Pros: native Vercel support, zero-latency routing, automatic preview composition, Vercel Toolbar integration.

Cons: $250/project/month per additional app beyond 2 included. With 5-6 apps: $750-$1,000/month.

Rejected on cost. The custom proxy pattern achieves the same result. Migration path preserved if pricing changes.

### Subdomains for all apps (`app.eleva.care`, `expert.eleva.care`, etc.)

Pros: hard boundaries everywhere, no gateway proxy needed.

Cons: fragments trust and SEO authority on the root domain. Product surfaces should share `eleva.care` for a unified user experience.

Rejected because product apps should live on the root domain (ADR-014 rationale).

## Consequences

- `apps/app` becomes a focused member dashboard with zero auth plumbing.
- `apps/account` centralizes all identity concerns (`accounts.google.com` model).
- `apps/admin` gets the hardest security boundary via subdomain isolation.
- The gateway `proxy.ts` grows to dispatch to multiple app origins but remains under 100 LOC.
- `@eleva/config/routing` is the source of truth for which path segments belong to which app.
- `@eleva/config/reserved-usernames` must include all org-scoped segments (`expert`, `team`, `academy`).
- Each new app needs its own Vercel project, environment variables, and port assignment.
- `@eleva/auth` org switching needs the `preferredOrgSlug` wiring to be connected in `getSession()`.
- Shared packages (`@eleva/auth`, `@eleva/db`, `@eleva/ui`, `@eleva/config`) become the integration layer.
- Build times improve as each app only rebuilds when its routes or shared dependencies change.

## Migration phases

1. **Phase 1**: Create `apps/account` behind gateway proxy (auth flows, onboarding, profile, org management)
2. **Phase 2**: Extract `apps/admin` to `admin.eleva.care` (smallest surface, highest security value)
3. **Phase 3**: Extract `apps/expert` (largest surface, most routes to move)
4. **Phase 4**: Create `apps/team` (new functionality for clinic org type)
5. **Phase 5**: Activate `apps/academy` when the LMS product takes shape

## Related docs

- [ADR-001-app-topology.md](./ADR-001-app-topology.md) -- original "one app first" decision (superseded)
- [ADR-014-multi-zone-rewrites.md](./ADR-014-multi-zone-rewrites.md) -- gateway + multi-zone pattern (extended)
- [ADR-003-tenancy-and-rls.md](./ADR-003-tenancy-and-rls.md) -- org isolation with RLS
- [`packages/config/src/routing.ts`](../../../packages/config/src/routing.ts) -- routing constants
- [`packages/config/src/reserved-usernames.ts`](../../../packages/config/src/reserved-usernames.ts) -- reserved slugs
- [`packages/auth/src/capabilities.ts`](../../../packages/auth/src/capabilities.ts) -- product labels and capability bundles
