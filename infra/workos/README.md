# infra/workos — WorkOS RBAC and Widgets

Declarative configuration for WorkOS. Two layers:

1. **App RBAC** — `rbac-config.json` (Eleva capability slugs) synced by `pnpm rbac:generate`
2. **Widgets** — `widgets-config.json` (WorkOS `widgets:*` permissions) synced by `pnpm widgets:generate` (not by `rbac-generate`)

See also [`docs/eleva-v3/identity-rbac-spec.md`](../../docs/eleva-v3/identity-rbac-spec.md).

## Prerequisites

- `WORKOS_API_KEY` set in `.env.local` (staging) or production secrets
- Node.js 24+, pnpm 11+
- "Multiple roles" enabled in WorkOS Dashboard (Settings → Roles)
- WorkOS Stripe Add-on connected (for entitlements in JWT)

## Files

| File                         | Purpose                                                       |
| ---------------------------- | ------------------------------------------------------------- |
| `rbac-config.json`           | App capabilities (`area:action`) and custom environment roles |
| `rbac-config.schema.json`    | JSON Schema for `rbac-config.json`                            |
| `rbac-generate.ts`           | Sync script for app RBAC (skips all `widgets:*` slugs)        |
| `rbac-config.test.ts`        | Tests for `rbac-config.json`                                  |
| `widgets-config.json`        | Widget component → token scopes → role widget grants          |
| `widgets-config.schema.json` | JSON Schema for `widgets-config.json`                         |
| `widgets-config.test.ts`     | Tests for `widgets-config.json`                               |
| `widgets-generate.ts`        | Sync script: merges `roleWidgetGrants` onto WorkOS roles      |
| `widget-permissions.ts`      | Pure merge helpers (used by script + tests)                   |
| `workos-api.ts`              | Shared WorkOS Authorization API helpers for both scripts      |

## Scripts

| Script                                           | Description                                       |
| ------------------------------------------------ | ------------------------------------------------- |
| `pnpm rbac:generate`                             | Dry-run: loads config, shows what would be synced |
| `pnpm rbac:generate --apply`                     | Applies changes to WorkOS (staging by default)    |
| `pnpm rbac:generate --env=production --apply`    | Applies to production environment                 |
| `pnpm widgets:generate`                          | Dry-run: widget grants from `widgets-config.json` |
| `pnpm widgets:generate --apply`                  | Merges widget grants onto roles (staging)         |
| `pnpm widgets:generate --env=production --apply` | Merges widget grants (production)                 |

## Root-level shortcut

From the monorepo root:

```bash
# Dry-run (staging)
pnpm rbac:generate

# Apply (staging)
pnpm rbac:generate -- --apply

# Apply (production)
pnpm rbac:generate -- --env=production --apply

# Widget grants (after rbac — preserves app capabilities, adds widgets:*)
pnpm widgets:generate
pnpm widgets:generate -- --apply
pnpm widgets:generate -- --env=production --apply
```

## What the script does (nuke-and-repave)

1. **Cleans up stale roles** — deletes custom roles that exist in WorkOS but are NOT in `rbac-config.json`. Skips protected system roles (`admin`, `member`).
2. **Ensures required roles exist** — creates any custom environment roles defined in the JSON that don't yet exist in WorkOS (e.g., `expert`, `team_admin`, `lecturer`, `staff`).
3. **Clears permissions on all managed roles** — removes current permission assignments so we can rebuild cleanly.
4. **Replaces all permissions** — deletes all non-system permissions, then recreates them from the JSON (with display names and descriptions).
5. **Assigns permissions to roles** — maps each role to its configured capabilities.

## Roles and capabilities

### Roles (custom environment roles)

| Role Slug    | Display Name | Description                                                                    |
| ------------ | ------------ | ------------------------------------------------------------------------------ |
| `expert`     | Expert       | Solo expert (community or top tier). Manages profile, availability, invoicing. |
| `team_admin` | Team Admin   | Clinic owner/admin. Manages team members, billing, settings.                   |
| `lecturer`   | Lecturer     | Academy instructor. Creates courses, manages content, views analytics.         |
| `staff`      | Staff        | Eleva internal operator. Platform administration and support.                  |

### Built-in WorkOS roles (not managed by script)

| Role     | Behavior                                                                                     |
| -------- | -------------------------------------------------------------------------------------------- |
| `admin`  | Inherits ALL permissions from all roles below it (full access)                               |
| `member` | Base role — our `member` capabilities are assigned to it via the script's permission mapping |

## Adding a new capability

1. Add entry to `rbac-config.json` → `capabilities` array:
   ```json
   {
     "slug": "domain:action_name",
     "displayName": "Human readable name (max 48 chars)",
     "description": "What this permission allows."
   }
   ```
2. Add the slug to the appropriate role(s) in the `roles` array
3. Run `pnpm rbac:generate -- --apply`
4. Update `packages/auth/src/capabilities.ts` if needed

## Adding a new role

1. Add entry to `rbac-config.json` → `roles` array:
   ```json
   {
     "slug": "new_role",
     "displayName": "New Role",
     "description": "What this role is for.",
     "capabilities": ["capability:one", "capability:two"]
   }
   ```
2. Run `pnpm rbac:generate -- --apply` — the script will create the role in WorkOS automatically
3. Update `packages/auth/src/capabilities.ts` → `WORKOS_ROLE_TO_LABEL` mapping

## Production deployment checklist

1. Ensure `WORKOS_API_KEY` is set for the production environment
2. Review `rbac-config.json` changes (PR review recommended)
3. Run `pnpm rbac:generate -- --env=production --apply`
4. Verify in WorkOS Dashboard: Authorization → Roles & Permissions
5. Test that JWT claims contain correct `permissions` for each role

## Idempotency

The script is designed as nuke-and-repave: it always converges to the state defined in `rbac-config.json` regardless of what currently exists in WorkOS. Safe to re-run at any time.

## Troubleshooting

| Issue                           | Cause                                  | Fix                                     |
| ------------------------------- | -------------------------------------- | --------------------------------------- |
| `displayName` too long          | WorkOS limits to 48 chars              | Shorten the display name                |
| Role not created                | Slug contains invalid chars            | Use `[a-z][a-z0-9_-]*` pattern          |
| `admin` shows fewer permissions | Normal — inherits from lower roles     | Not a bug; functional access is correct |
| 404 on role deletion            | Role already deleted or is system role | Safe to ignore                          |

## WorkOS Widgets (`widgets-config.json`)

Widget UIs (`@workos-inc/widgets`) call `https://api.workos.com/_widgets/...` from the browser. That requires:

1. **CORS** — allowed web origins in WorkOS Dashboard → Authentication → CORS (same environment as `WORKOS_API_KEY`)
2. **Widget permissions** — `widgets:*` slugs assigned to roles per `roleWidgetGrants` in `widgets-config.json`
3. **Token scopes** — `getWidgetTokenFromSession(scopes)` must match `tokenScopes` for that widget (or omit scopes when empty)

`rbac-generate.ts` intentionally **does not** sync `widgets:*` permissions. Use `widgets-generate.ts` instead.

**Run order:** always `pnpm rbac:generate -- --apply` first, then `pnpm widgets:generate -- --apply`. Re-running rbac alone clears widget grants on custom roles (`expert`, `team_admin`, etc.); run widgets again after rbac changes.

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
3. Run `pnpm widgets:generate -- --apply` (and production when ready).
4. Use `packages/auth/src/widget-scopes.ts` constants in code (keep in sync with JSON).
5. Run `pnpm --filter @eleva/infra-workos test`.
