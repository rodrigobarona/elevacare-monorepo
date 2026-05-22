---
name: workos-rbac-widgets
description: WorkOS app RBAC vs Widget permissions SSOT. Use when embedding @workos-inc/widgets, calling getWidgetTokenFromSession, configuring WorkOS roles/CORS, or fixing 403/CORS on api.workos.com/_widgets.
---

# WorkOS RBAC and Widgets

## Two layers (do not mix)

| Layer    | SSOT                               | Synced by script?                                            | Slug shape    |
| -------- | ---------------------------------- | ------------------------------------------------------------ | ------------- |
| App auth | `infra/workos/rbac-config.json`    | Yes — `pnpm workos:rbac:generate -- --apply`                 | `area:action` |
| Widgets  | `infra/workos/widgets-config.json` | Yes — `pnpm workos:widgets:generate -- --apply` (after rbac) | `widgets:...` |

## Workflow: embed or fix a widget

1. Read `infra/workos/widgets-config.json` → find `component` entry → note `tokenScopes` and `surfaces`.
2. In code, call `getWidgetTokenFromSession(scopesForWidget("userSessions"))` from `@eleva/auth` **only** when `tokenScopes` is non-empty; otherwise `getWidgetTokenFromSession()` with no args (same token as `UserProfile`).
3. For `UserSessions` with `currentSessionId`, pass SSR token as **string** + `sessionId` from `withAuth()` on the server page.
4. Never use `widgets:users-table:manage` on account settings widgets.

## Workflow: debug 403 / CORS on widget fetch

Browser errors like “blocked by CORS policy” on `api.workos.com/_widgets/...` are often **403 Forbidden** without CORS headers.

Check in order:

1. **Token scopes** — Network request uses widget JWT; scopes match `widgets-config.json` `tokenScopes`.
2. **Role grants** — Run `pnpm workos:widgets:generate -- --apply` if out of sync (`admin` needs `widgets:users-table:read` for personal Space account settings).
3. **CORS** — Dashboard → Authentication → CORS includes the page origin (e.g. `http://localhost:3006`) — not scripted.
4. **Environment** — Scripts use `WORKOS_API_KEY` (staging) or `WORKOS_API_KEY_PRODUCTION` (prod).

## Workflow: add a new widget

1. Add widget entry to `widgets-config.json` (`component`, `tokenScopes`, `workosPermissions`, `surfaces`).
2. Update `roleWidgetGrants` for each role that should use it.
3. Update `packages/auth/src/widget-scopes.ts` to mirror `tokenScopes`.
4. Run `pnpm workos:widgets:generate -- --apply`.
5. Run `pnpm --filter @eleva/infra-workos test`.

## Workflow: add app capability (not widget)

1. Edit `infra/workos/rbac-config.json` only.
2. Run `pnpm workos:rbac:generate -- --apply`.
3. Update `packages/auth/src/capabilities.ts` if needed.

## Key files

- `infra/workos/README.md` — operator docs + dashboard checklist
- `docs/eleva-v3/identity-rbac-spec.md` — product role catalog
- `.cursor/rules/workos-rbac-widgets.mdc` — quick reference rule
