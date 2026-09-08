---
name: better-auth
description: Add a Better Auth plugin, regenerate schema, add a permission, or rotate BETTER_AUTH_SECRET.
---

# Better Auth skill (ADR-017, ADR-021)

Context7 first: `/better-auth/better-auth` (options, organization, admin, api-key,
passkey, magic-link, jwt/bearer, Next.js). Training data is often stale.

## Add a plugin

1. Confirm it is in the locked set (ADR-017) or add a decision-log entry + ADR amendment.
2. Import from `better-auth/plugins` or `@better-auth/<name>` in `packages/auth/src/server.ts` only.
3. Add the matching client plugin in `packages/auth/src/client.ts`.
4. Catalog the package version in `pnpm-workspace.yaml`.
5. Regenerate schema (below) and wrap new hooks in `withAudit()`.

## Regenerate schema + migration

```bash
pnpm --filter=@eleva/auth auth:generate   # writes packages/db/src/schema/auth
pnpm --filter=@eleva/db db:generate       # main Drizzle migration
```

Hand-edit only indexes, RLS class headers and `additionalFields`. Commit both.

## Add a permission + capability

1. Add the statement in `packages/auth/src/permissions.ts`.
2. Grant it on the roles that should have it (`owner` / `admin` / `member` or a staff role).
3. Expose a named bundle in `capabilities.ts` if callers need one.
4. Add a table-driven test. No JSON, no Dashboard.

## Add a trusted origin

Edit the environment-specific `trustedOrigins` list in `@eleva/auth` / `environment-matrix.md`.
Never use `*`. Preview hosts call the staging API and are not origins that mint `.eleva.care`
cookies.

## Rotate `BETTER_AUTH_SECRET`

1. Deploy the new secret to staging; sessions reset.
2. Confirm sign-in + cookie on `.eleva.care`.
3. Promote to production in the Phase 15 runbook (operator-gated).
4. OAuth token encryption uses this secret — rotating it requires Better Auth's documented
   re-encrypt path; read current docs before applying.

The previous identity SDK, scripts, and widgets are gone (see ADR-017).
