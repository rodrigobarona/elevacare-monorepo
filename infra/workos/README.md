# infra/workos — WorkOS RBAC Provisioning

Declarative role and permission management for WorkOS. A single JSON config file (`rbac-config.json`) is the source of truth, and a "nuke-and-repave" script syncs it to WorkOS via API.

## Prerequisites

- `WORKOS_API_KEY` set in `.env.local` (staging) or production secrets
- Node.js 24+, pnpm 11+
- "Multiple roles" enabled in WorkOS Dashboard (Settings → Roles)
- WorkOS Stripe Add-on connected (for entitlements in JWT)

## Files

| File                      | Purpose                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| `rbac-config.json`        | Declarative source of truth: capabilities (permissions) and roles |
| `rbac-config.schema.json` | JSON Schema for validation and editor autocomplete                |
| `rbac-generate.ts`        | Sync script: reads JSON, calls WorkOS API to apply                |
| `rbac-config.test.ts`     | Unit tests validating config structure                            |

## Scripts

| Script                                        | Description                                       |
| --------------------------------------------- | ------------------------------------------------- |
| `pnpm rbac:generate`                          | Dry-run: loads config, shows what would be synced |
| `pnpm rbac:generate --apply`                  | Applies changes to WorkOS (staging by default)    |
| `pnpm rbac:generate --env=production --apply` | Applies to production environment                 |

## Root-level shortcut

From the monorepo root:

```bash
# Dry-run (staging)
pnpm rbac:generate

# Apply (staging)
pnpm rbac:generate -- --apply

# Apply (production)
pnpm rbac:generate -- --env=production --apply
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
