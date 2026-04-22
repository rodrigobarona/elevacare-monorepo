# 11 — Admin, Audit & Ops

> Internal back office, audit trail, scripts, role gates, and the operational hygiene that keeps Eleva running. The MVP has functional admin surfaces but light audit coverage and ad-hoc scripts; v2 formalizes both.

## What we built

### Admin surfaces (current)

Under [app/(private)/admin/](../../app/(private)/admin/):

| Surface             | Purpose                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `/admin/users`      | Search users, view, change role, view setup state, trigger Stripe Identity.                  |
| `/admin/payments`   | Refund handling, dispute management, payout queue (`payment_transfers`).                      |
| `/admin/categories` | CRUD on the six women's-health verticals.                                                     |

Layout at `app/(private)/admin/layout.tsx` enforces role gate via `checkRoles(['admin', 'superadmin'])`. (In v2 the gate collapses to `requireRole('admin')`; the `superadmin` role is removed and elevated permissions are granted to a small operator subset of admins via WorkOS group membership — see [18-rbac-and-permissions.md](18-rbac-and-permissions.md).)

### Audit log (current)

Separate Neon database (`AUDITLOG_DATABASE_URL`) with single table from [drizzle/auditSchema.ts](../../drizzle/auditSchema.ts):

```ts
audit_logs (
  id serial pk,
  clerkUserId text not null,           -- actor
  action varchar(50) not null,         -- e.g. 'user.role_changed'
  resourceType varchar(50) not null,   -- e.g. 'user', 'meeting', 'payment_transfer'
  resourceId varchar(255),
  oldValues jsonb,
  newValues jsonb,
  ipAddress varchar(45),
  userAgent text,
  createdAt timestamp default now()
)
```

Audit insert helper writes from server actions; coverage is partial — many state changes never make it.

### Scripts (current)

Under [scripts/](../../scripts/):

- `audit-expert-tax-readiness.ts` — one-off Stripe Tax / NIF audit.
- `fix-tax-reversal-compensation.ts` — backfill for a specific tax issue.
- `test-error-tracking.ts` — Sentry smoke test.
- `sql/` — manual SQL snippets.
- `utilities/` — assorted operational helpers.

These are run with `pnpm tsx <script>` (per `AGENTS.md`: never `npm` or `yarn`).

### `vercel.json`

Single Vercel cron for `/api/cron/keep-alive`. All other scheduling via QStash (see [09-workflows-and-async-jobs.md](09-workflows-and-async-jobs.md)).

## Why

- Admin surfaces shipped on the same Next.js stack to avoid a separate back-office app.
- Separate audit DB keeps OLTP hot data lean and allows different retention.
- Scripts as `.ts` files (run via `pnpm tsx`) avoid bundling concerns.

## What worked

- Single-app admin = no second auth surface to maintain.
- Audit DB separation simplifies retention policy decisions.
- `pnpm tsx` script-runner pattern works consistently.

## What didn't

| Issue                                  | Detail                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Audit coverage is partial**          | Many mutating server actions don't insert audit rows. Hard to forensic-trace.                                                       |
| **Audit `clerkUserId` is vendor-locked** | Hard to migrate when leaving Clerk. Should be a stable internal user ID.                                                            |
| **No correlation IDs**                 | An admin action that triggers a workflow that triggers an email cannot be traced through one ID.                                    |
| **Role gate only at layout level**     | A buggy server action could be invoked by anyone with a session if it doesn't recheck role.                                          |
| **No admin queue for Become-Partner**  | Expert acquisition is via direct email, not a structured queue. Doesn't scale.                                                      |
| **No subscription / billing admin UI** | v2 introduces expert subscriptions; need a place to view tier, lookup key, period, status, and override.                            |
| **No RBAC drift checker**              | Roles in Clerk metadata vs DB users table can desync. No tooling to detect.                                                         |
| **Scripts are unversioned in CI**      | One-off scripts can be re-run accidentally; no idempotency guard.                                                                   |
| **`/admin/categories` lacks i18n**     | Category names need localization across `pt`, `en`, `br`, `es`. Currently only one language.                                        |

## v2 prescription

### 1. Admin surfaces (expanded)

Under `src/app/(private)/admin/`:

| Surface                          | Purpose                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `/admin/users`                   | User search, view, role assignment via WorkOS membership API.                        |
| `/admin/orgs`                    | Org search, view; switch between expert/patient/clinic.                              |
| `/admin/become-partner`          | Queue of partner applications: `submitted` → `under_review` → `invited` → `accepted` / `rejected`. |
| `/admin/payment-transfers`       | Payout approval queue (renamed for clarity).                                          |
| `/admin/payments/[id]`           | Refund / dispute management with audit-logged actions.                                |
| `/admin/subscriptions`           | View expert subscription tier + lookup key + period; override for promotions.        |
| `/admin/categories`              | CRUD with per-locale translations.                                                   |
| `/admin/audit`                   | Searchable audit log (filter by actor, action, resource).                            |
| `/admin/feature-flags`           | (Future) toggle features per org or globally.                                         |
| `/admin/clinics`                 | (Phase 2) clinic-org management with three-party revenue settings.                   |

All gated by L1 (proxy) + L2 (layout) + L3 (server action `withPermission` decorator) + L4 (Postgres RLS admin bypass policy). See [18-rbac-and-permissions.md](18-rbac-and-permissions.md).

### 2. Audit log v2

```ts
// packages/db/audit-schema.ts
audit_logs (
  id uuid pk default gen_random_uuid(),
  correlation_id uuid not null,        -- links related actions across services
  actor_user_id text not null,         -- WorkOS user ID (NOT clerk)
  actor_org_id uuid,                   -- which org context the actor was in
  target_org_id uuid,                  -- which org owns the affected resource
  action varchar(100) not null,        -- e.g. 'user.role_changed', 'payout.approved'
  resource_type varchar(50) not null,
  resource_id varchar(255),
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  source varchar(50),                   -- 'web', 'workflow:bookingConfirmation', 'webhook:stripe'
  created_at timestamptz default now()
)
```

### 3. `withAudit` decorator

Every mutating server action and admin operation goes through:

```ts
export const approvePayout = withPermission('payouts:approve')(
  withAudit({ action: 'payout.approved', resourceType: 'payment_transfer' })(
    async (input) => {
      // ... mutation ...
      return { oldValues, newValues, resourceId };
    },
  ),
);
```

The decorator captures actor, target, IP, UA, and inserts the audit row in the same DB context. Uses correlation ID from request headers (auto-injected by `src/proxy.ts`).

### 4. Correlation IDs end-to-end

- Request enters proxy → assign `x-correlation-id` if missing.
- Server actions read it and pass to audit + Sentry tags.
- Workflows inherit it from the triggering event input.
- Resend transactional sends include it as a tag.
- Stripe webhook handlers read it from event metadata when set.

Result: any incident can be traced through a single correlation ID across web/audit/Sentry/Resend/workflow logs.

### 5. Operational scripts

Move to `scripts/` at monorepo root, organized by domain:

```text
scripts/
├── stripe/
│   ├── seed-lookup-keys.ts
│   ├── audit-tax-readiness.ts
│   └── reconcile-application-fees.ts
├── workos/
│   ├── backfill-orgs.ts
│   ├── rbac-drift-check.ts
│   └── sync-all-users.ts
├── db/
│   ├── seed-categories.ts
│   ├── enable-rls.ts
│   └── grant-admin.ts
├── ops/
│   ├── rotate-vault-keys.ts
│   ├── purge-soft-deleted.ts
│   └── reset-multibanco-reminders.ts
└── README.md
```

All scripts:
- Importable as a function for testing.
- Idempotent (safe to re-run).
- Take a `--dry-run` flag.
- Log to Sentry breadcrumbs with a script name tag.

### 6. RBAC drift checker

A script `scripts/workos/rbac-drift-check.ts` that:

- Lists every WorkOS membership.
- Compares against expected role from local DB membership mirror.
- Reports drift.
- Optionally repairs (`--repair`).

Run nightly via Vercel cron triggering a `rbacDriftCheck` workflow.

### 7. Become-Partner queue

Capture form at `/become-partner` (public, BotID-protected) writes to `partner_applications`:

```ts
partner_applications (
  id uuid pk,
  email text unique,
  full_name text,
  specialties text[],
  country text,
  bio text,
  cv_blob_url text,
  status varchar(20) default 'submitted',
  reviewer_user_id text,
  notes text,
  created_at, updated_at
)
```

Admin queue at `/admin/become-partner` shows pending; approve sends WorkOS magic-link invite + creates expert org on signup callback.

### 8. Subscription admin

`/admin/subscriptions` lists every active expert subscription with:

- Org, expert name, current tier, lookup key, period, status, current_period_end, MRR contribution.
- Action: cancel at period end, switch tier (admin override for support cases), apply credit.
- Audit-logged.

### 9. Audit log retention

- App data: 30 days hot, archived to cold storage after.
- Audit log: 7 years (regulatory expectation for healthcare-adjacent platforms).
- GDPR right-to-erasure: replace `actor_user_id` and `target_org_id` with `'[erased]'` in audit rows tied to deleted accounts; preserve action+timestamp for compliance.

## Concrete checklist for the new repo

- [ ] All admin routes gated at L1 (proxy) + L2 (layout) + L3 (`withPermission`) + L4 (RLS admin bypass policy).
- [ ] `withAudit` decorator wraps every mutating server action and admin op.
- [ ] Audit DB schema includes `correlation_id`, `actor_user_id` (WorkOS), `actor_org_id`, `target_org_id`, `source`.
- [ ] `x-correlation-id` injected by proxy if missing; propagated to workflows and Resend tags.
- [ ] Become-Partner queue exists at `/become-partner` (public) and `/admin/become-partner` (admin).
- [ ] Subscription admin exists at `/admin/subscriptions`.
- [ ] RBAC drift checker runs nightly and alerts to Sentry on drift.
- [ ] All operational scripts under `scripts/` with `--dry-run` support and idempotency.
- [ ] Audit-log retention policy documented and a purge job runs.
- [ ] GDPR erasure handler scrubs PII from audit rows for deleted accounts.
- [ ] Categories table has per-locale `name` columns or a translations join table.
