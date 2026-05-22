# infra/workos — WorkOS RBAC and Widgets

Declarative configuration for WorkOS. Two layers:

1. **App RBAC** — `rbac-config.json` (Eleva capability slugs) synced by `pnpm workos:rbac:generate`
2. **Widgets** — `widgets-config.json` (WorkOS `widgets:*` permissions) synced by `pnpm workos:widgets:generate` (not by `rbac-generate`)

See also [`docs/eleva-v3/identity-rbac-spec.md`](../../docs/eleva-v3/identity-rbac-spec.md).

## Prerequisites

- `WORKOS_API_KEY` set in `.env.local` (staging) or production secrets
- Node.js 24+, pnpm 11+
- "Multiple roles" enabled in WorkOS Dashboard (Settings → Roles)
- WorkOS Stripe Add-on connected (for entitlements in JWT)

## Files

| File                         | Purpose                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `rbac-config.json`           | App capabilities (`area:action`) mapped onto WorkOS `admin` / `member` roles |
| `rbac-config.schema.json`    | JSON Schema for `rbac-config.json`                                           |
| `rbac-generate.ts`           | Sync script for app RBAC (skips all `widgets:*` slugs)                       |
| `rbac-config.test.ts`        | Tests for `rbac-config.json`                                                 |
| `widgets-config.json`        | Widget component → token scopes → role widget grants                         |
| `widgets-config.schema.json` | JSON Schema for `widgets-config.json`                                        |
| `widgets-config.test.ts`     | Tests for `widgets-config.json`                                              |
| `widgets-generate.ts`        | Sync script: merges `roleWidgetGrants` onto WorkOS roles                     |
| `widget-permissions.ts`      | Pure merge helpers (used by script + tests)                                  |
| `workos-api.ts`              | Shared WorkOS Authorization API helpers for both scripts                     |

## Scripts

| Script                                                     | Description                                    |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `pnpm workos:rbac:generate`                                | Dry-run: preview app capability sync           |
| `pnpm workos:rbac:generate -- --apply`                     | Applies changes to WorkOS (staging by default) |
| `pnpm workos:rbac:generate -- --env=production --apply`    | Applies to production environment              |
| `pnpm workos:widgets:generate`                             | Dry-run: preview widget grant merge            |
| `pnpm workos:widgets:generate -- --apply`                  | Merges widget grants onto roles (staging)      |
| `pnpm workos:widgets:generate -- --env=production --apply` | Merges widget grants (production)              |

## Root-level shortcut

From the monorepo root:

```bash
# Dry-run (staging)
pnpm workos:rbac:generate

# Apply (staging)
pnpm workos:rbac:generate -- --apply

# Apply (production)
pnpm workos:rbac:generate -- --env=production --apply

# Widget grants (after rbac — preserves app capabilities, adds widgets:*)
pnpm workos:widgets:generate
pnpm workos:widgets:generate -- --apply
pnpm workos:widgets:generate -- --env=production --apply
```

## What the script does (nuke-and-repave)

1. **Ensures required roles exist** — updates metadata for `admin` and `member` (WorkOS org-seniority roles).
2. **Replaces all permissions** — deletes all non-system permissions, then recreates them from the JSON (with display names and descriptions).
3. **Assigns permissions to roles** — maps capability supersets onto `admin` and `member` in one PUT per role.

## Roles and capabilities

WorkOS org-seniority roles are the **backbone** (`admin`, `member`). Eleva **product labels** (patient, expert, clinic admin, lecturer, staff) are derived at runtime from `(org_type, workos_role)` — see [`docs/eleva-v3/identity-rbac-spec.md`](../../docs/eleva-v3/identity-rbac-spec.md) and the [RBAC backbone decision log entry](../../docs/eleva-v3/decision-log.md#2026-04-22-rbac-backbone--workos-adminmember-defaults--capability-bundles).

| WorkOS role | Config in `rbac-config.json`                     | Runtime product label examples                                             |
| ----------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| `admin`     | Superset of all admin-context capability bundles | Patient (`personal` org), solo expert, clinic admin, lecturer, Eleva staff |
| `member`    | Expert-in-clinic capability bundle               | Expert as clinic org member                                                |

`packages/auth/src/session.ts` intersects JWT `permissions` with the derived bundle for the active org, so the WorkOS `admin` superset does not grant cross-context access.

Widget grants in `widgets-config.json` attach only to **`admin`** and **`member`** (not product labels).

## Adding a new capability

1. Add entry to `rbac-config.json` → `capabilities` array:
   ```json
   {
     "slug": "domain:action_name",
     "displayName": "Human readable name (max 48 chars)",
     "description": "What this permission allows."
   }
   ```
2. Add the slug to the appropriate WorkOS role (`admin` or `member`) in the `roles` array
3. Run `pnpm workos:rbac:generate -- --apply`
4. Update `packages/auth/src/capabilities.ts` if needed

## Adding capabilities to a product bundle

Product labels are derived in code (`packages/auth/src/capabilities.ts`). When a new capability belongs to a specific product context, add it to the relevant bundle in `CAPABILITY_BUNDLES` and to the appropriate WorkOS role superset in `rbac-config.json` (`admin` and/or `member`).

## Production deployment checklist

1. Ensure `WORKOS_API_KEY_PRODUCTION` is set for the production environment (falls back to `WORKOS_API_KEY`)
2. Review `rbac-config.json` changes (PR review recommended)
3. Run `pnpm workos:rbac:generate -- --env=production --apply`
4. Verify in WorkOS Dashboard: Authorization → Roles & Permissions
5. Test that JWT claims contain correct `permissions` for each role

## Idempotency

The script is designed as nuke-and-repave: it always converges to the state defined in `rbac-config.json` regardless of what currently exists in WorkOS. Safe to re-run at any time.

## Troubleshooting

| Issue                           | Cause                              | Fix                                     |
| ------------------------------- | ---------------------------------- | --------------------------------------- |
| `displayName` too long          | WorkOS limits to 48 chars          | Shorten the display name                |
| Role not created                | Slug contains invalid chars        | Use `[a-z][a-z0-9_-]*` pattern          |
| `admin` shows fewer permissions | Normal — inherits from lower roles | Not a bug; functional access is correct |

## WorkOS Widgets (`widgets-config.json`)

Widget UIs (`@workos-inc/widgets`) call `https://api.workos.com/_widgets/...` from the browser. That requires:

1. **CORS** — allowed web origins in WorkOS Dashboard → Authentication → CORS (same environment as `WORKOS_API_KEY`)
2. **Widget permissions** — `widgets:*` slugs assigned to roles per `roleWidgetGrants` in `widgets-config.json`
3. **Token scopes** — `getWidgetTokenFromSession(scopes)` must match `tokenScopes` for that widget (or omit scopes when empty)

`rbac-generate.ts` intentionally **does not** sync `widgets:*` permissions. Use `widgets-generate.ts` instead.

> **WARNING:** `pnpm workos:rbac:generate -- --apply` replaces role permission assignments and **will remove widget grants** from roles. You **must** run `pnpm workos:widgets:generate -- --apply` immediately afterward or widget access will break.

**Run order:** always `pnpm workos:rbac:generate -- --apply` first, then `pnpm workos:widgets:generate -- --apply`.

### Widget scope quick reference

| Component              | `tokenScopes`                        | Never use on account settings |
| ---------------------- | ------------------------------------ | ----------------------------- |
| `UserProfile`          | _(none)_                             | `widgets:users-table:manage`  |
| `UserSecurity`         | _(none)_                             | `widgets:users-table:manage`  |
| `UserSessions`         | `widgets:users-table:read`           | `widgets:users-table:manage`  |
| `UsersManagement`      | `widgets:users-table:manage`         | —                             |
| `OrganizationSwitcher` | `widgets:organization-switcher:read` | —                             |

Personal Space users are WorkOS **`admin`** on their org — grant `widgets:users-table:read` on the `admin` role so account settings widgets work.

### Widget sync script (`widgets-generate`)

1. **Creates** any missing `widgets:*` permissions declared in `roleWidgetGrants` (WorkOS does not ship all read slugs by default).
2. For each role, **merges** widget grants with existing permissions (non-`widgets:*` slugs are preserved).
3. Does **not** configure CORS (Dashboard only).

```bash
# Staging (uses WORKOS_API_KEY from .env.local)
pnpm workos:widgets:generate
pnpm workos:widgets:generate -- --apply

# Production (uses WORKOS_API_KEY_PRODUCTION)
pnpm workos:widgets:generate -- --env=production --apply
```

### Widget dashboard checklist (CORS only)

1. Open the WorkOS environment that matches your API key (staging `sk_test_*` vs production).
2. Authentication → CORS: include `http://localhost:3006`, `https://dev.eleva.care`, `https://eleva.care` (and other app ports from the env matrix).
3. Re-test account settings: `GET /_widgets/UserProfile/sessions` should return **200**, not 403.

### Adding a new widget surface

1. Add an entry to `widgets-config.json` → `widgets` array.
2. Update `roleWidgetGrants` for every role that should use the widget.
3. Run `pnpm workos:widgets:generate -- --apply` (and production when ready).
4. Use `packages/auth/src/widget-scopes.ts` constants in code (keep in sync with JSON).
5. Run `pnpm --filter @eleva/infra-workos test`.
