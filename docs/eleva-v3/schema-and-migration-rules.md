# Eleva.care v3 Schema And Migration Rules

Status: Living

## Purpose

This document defines the rules for database schema evolution and migrations in Eleva.care v3.

It should guide:

- `packages/db`
- Drizzle schema changes
- migration sequencing
- environment promotion

## Principles

- The domain model should lead schema design.
- Schema changes should be explicit, reviewable, and reversible where practical.
- Migrations should be treated as production changes, not incidental code edits.
- Avoid hidden schema drift between environments.

## Ownership

`packages/db` should be the single home for:

- schema definitions
- migrations
- seed helpers where used
- database conventions

Apps should not define competing schema sources.

## Migration Rules

- Every meaningful schema change should result in an explicit migration.
- Migration intent should be understandable from the PR and docs context.
- Risky data migrations should be documented separately if they are non-trivial.
- Do not mix unrelated schema changes into one migration casually.

## Review Expectations

Schema changes should be reviewed for:

- domain correctness
- authorization/data-boundary impact
- performance/index implications
- migration safety
- effect on mobile/API/search/reporting flows

## Sensitive Data Considerations

Changes touching these areas require extra review:

- transcripts
- reports
- documents
- diary data
- consent records
- payout/payment state
- permission/membership state

## Backward Compatibility

Where practical, prefer migration sequences that reduce deploy risk.

Examples:

- add nullable column -> backfill -> enforce later
- add new structure before removing old structure

Do not rely on perfect lockstep deploy assumptions for risky changes.

## Environment Flow

The team should explicitly define and follow:

- local migration workflow
- staging migration workflow
- production promotion workflow

## Data Migrations

If a change needs data backfill or transformation, document:

- what changes
- how it is executed
- how it is verified
- rollback or mitigation approach

## Seeding And Fixtures

If seed data exists, it should support:

- local development
- staging smoke tests where useful

Seed logic should not become a substitute for real migration discipline.

## RLS policy-class taxonomy

Every tenant-scoped table declares **exactly one** class. The class is named in the schema
file header comment and listed here. Phase 1.2 adds `packages/db/src/__tests__/rls-classes.test.ts`
(parametrised suite; one fixture + positive/negative assertion per class). Session settings
read: `eleva.org_id`, `eleva.user_id`, `eleva.platform_admin`, and later `eleva.staff_role`.

| Class                 | Predicate (canonical)                                                                                                                     | Who reads                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `tenant-owned`        | `org_id::text = current_setting('eleva.org_id', true)`                                                                                    | members of the active org                |
| `dual-organization`   | `SELECT`: `org_id` **or** `counterparty_org_id`. Writes: `org_id` only                                                                    | both sides of a booking may read         |
| `owner-user-visible`  | `user_id::text = current_setting('eleva.user_id', true)` (plus org match when present)                                                    | the owning human                         |
| `participant-visible` | exists a `session_participants` / booking participant row for `eleva.user_id`                                                             | session members                          |
| `staff-only`          | `current_setting('eleva.platform_admin', true) = 'true'`                                                                                  | Eleva staff                              |
| `public-read`         | `SELECT` unrestricted (or `published_at IS NOT NULL`); `WITH CHECK` remains tenant-owned                                                  | marketplace                              |
| `service-only`        | `eleva.platform_admin` **or** a named service role (`eleva.service = 'stripe_webhook'` / `'audit_drainer'` / `'domain_events_publisher'`) | webhooks, drainers, staff+service tables |

`CREATE POLICY` template (tenant-owned):

```sql
CREATE POLICY <table>_tenant_isolation ON <table>
  USING (org_id::text = current_setting('eleva.org_id', true))
  WITH CHECK (org_id::text = current_setting('eleva.org_id', true));
```

`organizations` is tenant-owned with `id` in place of `org_id`. Two tables use a split
predicate (still the same seven classes, not an eighth). Audit DB `audit_events`: `SELECT` is
`tenant-owned` (matching `eleva.org_id`, plus the `eleva.platform_admin` bypass on the
policy); `INSERT` is `service-only` (`eleva.service = 'audit_drainer'` only — no platform-admin write).
`public-read` is one class: published rows are world-readable; writes stay tenant-owned.
`public_handles` is the documented exception: SELECT is public-read (`USING true`) and
writes are staff-only (`eleva.platform_admin`). The table has no `org_id` because
handles are a global namespace (one citext PK), so a tenant-owned WITH CHECK cannot
be expressed. This is still the same seven classes — a split predicate, not an eighth.

### Current table assignments

| Table                       | Class                                                       |
| --------------------------- | ----------------------------------------------------------- |
| `organizations`             | tenant-owned (`id`)                                         |
| `memberships`               | tenant-owned                                                |
| `expert_profiles`           | tenant-owned                                                |
| `expert_listings`           | public-read                                                 |
| `clinic_profiles`           | public-read                                                 |
| `expert_integrations`       | tenant-owned                                                |
| `schedules`                 | tenant-owned                                                |
| `availability_rules`        | tenant-owned                                                |
| `date_overrides`            | tenant-owned                                                |
| `event_types`               | tenant-owned                                                |
| `event_type_modes`          | tenant-owned                                                |
| `booking_links`             | tenant-owned                                                |
| `calendar_feed_tokens`      | tenant-owned                                                |
| `public_handles`            | staff-only writes + public-read SELECT                      |
| `expert_practice_locations` | tenant-owned                                                |
| `event_locations`           | tenant-owned                                                |
| `calendar_busy_sources`     | tenant-owned                                                |
| `calendar_destinations`     | tenant-owned                                                |
| `slot_reservations`         | tenant-owned                                                |
| `bookings`                  | dual-organization                                           |
| `booking_payments`          | tenant-owned                                                |
| `consents`                  | tenant-owned                                                |
| `sessions`                  | participant-visible                                         |
| `billing_customers`         | tenant-owned                                                |
| `billing_subscriptions`     | tenant-owned                                                |
| `audit_outbox`              | service-only                                                |
| `domain_events_outbox`      | service-only                                                |
| `domain_event_deliveries`   | service-only                                                |
| `stripe_webhook_events`     | service-only                                                |
| `users`                     | owner-user-visible                                          |
| `notification_preferences`  | owner-user-visible                                          |
| `dsar_requests`             | owner-user-visible SELECT/INSERT + staff-only UPDATE/DELETE |
| `account_deletion_requests` | owner-user-visible SELECT/INSERT + staff-only UPDATE/DELETE |
| `expert_categories`         | public-read                                                 |
| `audit_events` (audit DB)   | tenant-owned SELECT + service-only INSERT                   |

Classes with no current un-split table use a synthetic `_rls_fixture_<class>` in the
Phase 1.2 suite. `owner-user-visible` is proven on `notification_preferences`. Future
migrations declare the class in the header comment.

## Localized column contract

Translatable content is **one JSONB column per field**, never rows-per-locale and never
`title_pt` / `title_en` suffix columns.

- `LocalizedText` in `packages/db/src/schema/main/shared.ts` is
  `Partial<Record<Locale, string>>` keyed by the `Locale` union (`pt \| en \| es`).
- `LocalizedRichText` (Phase 4B / ADR-023) is
  `Partial<Record<Locale, { json, html, text, source: "human" \| "ai_draft" }>>`.
- A sibling `_source_locale` column names the required key. Display uses
  `pickLocalized(value, requested, fallback = [source, "en"])`.
- Zod schemas live next to the type in `@eleva/i18n`. Cheap CHECK:
  `jsonb_typeof(title) = 'object'`.
- FTS uses per-locale expression indexes on `description->'<locale>'->>'text'` with
  `eleva_fts_pt/en/es` (already in `run-fts.ts`). No GIN on the JSONB document itself.
- **Tech debt (remove in Phase 4 PR 04.1):** `expert-categories.ts` declares a duplicate
  `LocalizedString` — delete it and import `LocalizedText`.

## Audit database migrations

`packages/db` has a second Drizzle config (`drizzle.config.audit.ts`) pointing at the
audit Neon project. Scripts `db:generate:audit` / `db:migrate:audit` write SQL under
`packages/db/src/migrations/audit/` (same layout as `src/migrations/main`). Never run
main-project migrations against the audit URL. CI applies main migrations with
`db:migrate` on the per-PR Neon branch.

## Related Docs

- [`domain-model.md`](./domain-model.md)
- [`api-contract-spec.md`](./api-contract-spec.md)
- [`testing-strategy.md`](./testing-strategy.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
