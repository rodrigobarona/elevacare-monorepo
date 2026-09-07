# Phase 14 — MVP data migration scripts + rehearsals

| Field      | Value                                                                                                                                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-14/mvp-migration`                                                                                                                                                                                                                                                                 |
| Depends on | Phase 13                                                                                                                                                                                                                                                                                 |
| Effort     | 2 weeks                                                                                                                                                                                                                                                                                  |
| Touches    | `infra/migration/**` (new package `@eleva/infra-migration`), `packages/db` (staging tables `migration_*`), `apps/web` redirects (`next.config` / gateway), `packages/email` (welcome/set-password campaign), `docs/eleva-v3/operator-tasks/**`                                           |
| Exit gate  | Three full rehearsals on Neon branches of a production snapshot with row-count and checksum reports within tolerance; every migrated expert can sign in via magic link and sees history; records decrypted from WorkOS Vault and re-encrypted; Stripe objects linked; rollback rehearsed |

## Why this phase exists

ADR-019: the live MVP (WorkOS + Neon + Stripe Connect) must move into v3 without losing experts,
members, bookings, payout history or records. Passwords cannot be exported from WorkOS, and
records are encrypted with WorkOS Vault, so the migration must run **before** WorkOS is cancelled.

## Scope

In:

- `infra/migration/` (tsx scripts, idempotent, `--dry-run` default, `--apply` to write,
  `--since <ts>` for delta runs, `--report <path>` JSON+Markdown): source = MVP Neon (read-only
  role), target = v3 Neon branch or production. **Production guard**: writes require
  `--target production` **and** `MIGRATION_CONFIRM_PRODUCTION=<today's date YYYY-MM-DD>` **and**
  an interactive typed confirmation of the target Neon project id; without `--target production`
  the CLI refuses any `TARGET_DATABASE_URL` whose host is not a Neon _branch_ endpoint of the
  staging/rehearsal project (`MIGRATION_ALLOWED_TARGET_HOSTS` allowlist). Rehearsals therefore
  cannot write to production by accident.
- **Entity mapping** (MVP `drizzle/schema.ts` -> v3):
  - `UsersTable` -> `auth.user` (email, emailVerified, name, image, `locale`, `country`,
    `timezone`, createdAt) + `auth.account` provider `credential` **without** password (forces
    set-password) and provider `google` when the MVP has a Google identity (by verified email);
    MVP roles (`user`, `top_expert`, `community_expert`, `admin`, `superadmin`) -> admin plugin role
    (`platform_admin` for superadmin/admin) + expert profile flags.
  - `OrganizationsTable` + `UserOrgMembershipsTable` -> `auth.organization` (`patient_personal`
    -> `personal` Space named `{firstName}'s Space`; `expert_individual` -> `expert`; `clinic` ->
    `team`) + `auth.member` (owner/admin/member).
  - `ProfilesTable`, `CategoriesTable`, `ExpertSetupTable`, `ExpertApplicationsTable` ->
    `expert_profiles`, `expert_categories`, `expert_listings`, `become_partner_applications`
    (status mapped), `billing_customers` (Stripe Connect account id, customer id, identity status).
  - `EventsTable` -> `event_types` (slug preserved for URL compatibility), `SchedulesTable` +
    `ScheduleAvailabilitiesTable` -> `schedules` + `availability_rules`, `BlockedDatesTable` ->
    `date_overrides`, `SchedulingSettingsTable` -> expert scheduling defaults.
  - `MeetingsTable` -> `bookings` (+ `sessions` for future meetings; Meet links dropped; Daily rooms
    created by the Phase 9 sweep after cutover) + `booking_payments` (payment intent id, amounts,
    fee), `PaymentTransfersTable` + `TransactionCommissionsTable` -> `payout_states` (status
    mapping, transfer ids, `applied_commission_bps` from the ledger), `SlotReservationsTable`
    dropped (expired), `SubscriptionPlansTable` + `SubscriptionEventsTable` +
    `AnnualPlanEligibilityTable` -> `billing_subscriptions` + grandfather flags
    (`commission_override_bps` with expiry per finance mapping table).
  - `RecordsTable` -> `records` (kind `note|report`), decrypted from WorkOS Vault using the MVP's
    `@workos-inc` Vault client **in the migration package only** (temporary, isolated dependency)
    and re-encrypted with `encryptForOrg(expertOrgId)`; checksums (SHA-256 of plaintext) stored in
    `migration_checksums` for verification, never the plaintext.
  - `AuditLogsTable` -> appended to the audit Neon project as `legacy_audit_events` via
    `@eleva/audit` bulk import.
  - Google Calendar tokens: dropped (forced re-connect; notification kind `calendar.reconnect_required`).
- **Identity strategy**: welcome campaign (`packages/email` template `migration.welcome`) with a
  set-password/magic link per user, sent in waves; Google users can just sign in.
- **URL compatibility**: preserve `/[locale]/[username]` and `/[locale]/[username]/[eventSlug]`;
  301 map for changed paths (`/[locale]/appointments/*` -> `/app/*`, old expert routes ->
  `/expert/*`) in `apps/web` gateway redirects; `_context` MVP route list as source.
- **Stripe**: same platform account; verify each Connect account id exists (`accounts.retrieve`),
  each customer id exists; no object creation; update webhook endpoint at cutover (Phase 15).
- **Rehearsals**: `pnpm migration:rehearse` = create Neon branch from production snapshot (MVP
  db exported to a v3-side branch or direct cross-DB read), run full migration, run verification
  (`pnpm migration:verify` -> row counts per table, checksum matches, orphan FK check, sample
  logins via magic link in staging), produce report under `infra/migration/reports/<date>.md`
  (committed). Three rehearsals required; the last within 3 days of cutover.
- **Freeze plan** (executed in Phase 15): MVP read-only banner + disabled booking, drain pending
  Multibanco (> 8 days rule means none should exist within 24h — verify), final delta run,
  verification, DNS switch.

Out: cutover itself (Phase 15).

## Deliverables

1. `infra/migration/{package.json,README.md,src/{cli.ts,source.ts,target.ts,map/*.ts,verify.ts,report.ts},reports/}`.
2. `migration_runs`, `migration_id_map` (unique on source table + source id), `migration_checksums`
   (unique on target table + target id, upserted) tables in a `migration` schema on v3, dropped
   after Phase 15 + 30 days.
3. Welcome campaign template + sender script (`migration:send-welcome --wave n`).
4. Redirect map + tests.
5. Three committed rehearsal reports; finance-approved grandfather mapping table
   (`infra/migration/GRANDFATHER.md`).
6. Runbook `operator-tasks/cutover-runbook.md` (used by Phase 15).

## Acceptance criteria

- [ ] Dry run on a snapshot completes with a report listing counts per entity and zero fatal
      mapping errors; warnings triaged.
- [ ] Apply run on a Neon branch: row counts within tolerance (documented per table; 0 loss for
      users/experts/bookings/payments/records), FK orphan check zero, checksums 100% for records.
- [ ] Re-running apply is a no-op (idempotent by `migration_id_map`).
- [ ] Production guard tests: `--apply` against a host not in `MIGRATION_ALLOWED_TARGET_HOSTS`
      exits 2 before connecting; `--target production` without today's
      `MIGRATION_CONFIRM_PRODUCTION` or with a wrong typed project id exits 2;
      `migration:rehearse` rejects `--target production`.
- [ ] Sample migrated expert signs in via magic link on staging, sees profile, event types,
      availability, past bookings, payout history; public URL `/[username]/[eventSlug]` resolves.
- [ ] Records decrypt for the owning expert in `apps/expert`; member sees published ones.
- [ ] Stripe verification step passes for 100% of Connect accounts and customers.
- [ ] Rollback rehearsal: DNS revert + MVP unfreeze steps executed on staging equivalents and timed.

## Tests

- vitest on mapping functions (role mapping, org type mapping, payout state mapping, slug
  preservation, checksum), redirect map.

## Docs to update

- ADR-019 (final), `operator-tasks/cutover-runbook.md`, `launch-readiness-checklist.md`,
  `data-retention-export-matrix.md` (legacy audit), `decision-log.md`.

## Local references

- MVP schema `_context/clone-repo/eleva-care-app/drizzle/schema.ts` (all tables listed above),
  `_context/clone-repo/eleva-care-app/src/lib/integrations/workos/**` (Vault usage),
  `_context/clone-repo/eleva-care-app/src/app/[locale]/**` (route list for redirects),
  `_context/blueprints/elevacare-mvp/*`.
- v3: `packages/db/src/schema/**`, `packages/encryption` (Phase 3), `packages/audit`,
  `packages/billing/src/server/commission.ts`, `packages/email`.
- ADR-019, `docs/eleva-v3/pii-removal-plan.md`, `docs/eleva-v3/launch-readiness-checklist.md`.

## External docs

- Neon branching + PITR `/websites/neon_com_docs`; Stripe `accounts.retrieve`/`customers.retrieve`
  `/websites/stripe`; WorkOS Vault SDK (read-only decrypt) — WorkOS docs; Better Auth account
  linking `/better-auth/better-auth`.

## Risks

- WorkOS Vault availability: export records first, verify checksums, keep the WorkOS account until
  Phase 15 + verification.
- Cross-database access: prefer `pg_dump`/`pg_restore` of the MVP into a `legacy` schema on the
  v3 branch for rehearsals; production run reads live MVP with a read-only role.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (encryption, audit-wiring, api-first-agentic, better-auth)
   and .cursor/skills/{audit-wiring,coderabbit-review}/SKILL.md; ~/.claude/skills/{neon-postgres,
   drizzle-migrations,gdpr-data-handling}/SKILL.md when present.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/14-mvp-migration.md in full.
3. Read every file under "Local references" — the MVP drizzle/schema.ts end to end and the v3
   schema. Pull Neon branching/PITR, Stripe retrieve APIs, WorkOS Vault decrypt and Better Auth
   account linking docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-14/mvp-migration
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm build
- Run: pnpm review -> fix -> repeat. Conventional Commits. pnpm review:branch -> fix.
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green; request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.
- Never run --apply against production in this phase. Rehearsals run on Neon branches only.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for pt/en/es, cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 14 TASK — MVP -> v3 data migration tooling and three rehearsals (ADR-019).

1. Create infra/migration (@eleva/infra-migration, tsx, isolated deps incl. @workos-inc/node for
   Vault decrypt ONLY here — add an eslint boundary exception scoped to this package and a CI
   guard that this package is never imported by apps/packages). CLI: pnpm migration:run
   --dry-run|--apply [--target branch|production] --since <iso> --report <path>;
   pnpm migration:verify; pnpm migration:rehearse (creates a Neon branch of the v3 *production*
   project — empty of tenant data before cutover, so the branch carries the real production
   schema, roles and extensions — restores a fresh pg_dump of the MVP production database (taken
   with the read-only role) into schema legacy via pg_restore, runs run --apply --target branch,
   then verify, then writes reports/<date>.md; staging snapshots are never a rehearsal input); pnpm migration:send-welcome --wave <n>
   --size <k>. Env: MVP_DATABASE_URL (read-only role), TARGET_DATABASE_URL, WORKOS_API_KEY
   (Vault read), STRIPE_SECRET_KEY, ELEVA_KEK_V1, MIGRATION_ALLOWED_TARGET_HOSTS.
   Production guard (implement in infra/migration/src/guard.ts with unit tests): --apply defaults
   to --target branch. In branch mode the guard resolves the TARGET_DATABASE_URL host through the
   Neon API (NEON_API_KEY, NEON_PROJECT_ID = the v3 production project — the same project the
   rehearsal branches are created in) and requires (a) the endpoint to belong to that project,
   (b) its branch to be a non-default branch (never the primary/production branch), and (c) the
   host to appear in MIGRATION_ALLOWED_TARGET_HOSTS, which migration:rehearse appends with the
   endpoint host it just created (so the allowlist and the rehearsal target always agree).
   --target production requires the host to be the project's default-branch endpoint,
   MIGRATION_CONFIRM_PRODUCTION to equal today's date (YYYY-MM-DD, UTC) and an interactive prompt
   where the operator types the Neon project id; any mismatch exits 2 before opening a
   connection. Unit tests cover: rehearsal branch accepted, default branch rejected in branch
   mode, foreign project rejected, production without confirmation rejected.
   migration:rehearse never accepts --target production.
2. Tables on the target in schema migration: migration_runs (id, started_at, finished_at, mode,
   since, stats jsonb, status), migration_id_map (source_table, source_id, target_table, target_id,
   unique(source_table, source_id)), migration_checksums (target_table, target_id, sha256,
   unique(target_table, target_id) — checksum rows are upserted on that key so a repeated
   --apply is a no-op for checksums too). Every mapper is idempotent through migration_id_map
   (upsert by source id); a test runs --apply twice on a fixture and asserts identical row counts
   in every target table including migration_checksums.
3. Mappers in src/map/*.ts, run in dependency order: users (UsersTable -> auth.user + auth.account
   credential row without password + google account when identity exists; roles -> admin plugin
   role platform_admin for admin/superadmin; locale/country/timezone), organizations
   (patient_personal -> personal Space `${firstName}'s Space`; expert_individual -> expert;
   clinic -> team) + memberships -> auth.member, expert profiles/categories/listings/applications
   -> expert_profiles, expert_categories, expert_listings, become_partner_applications (status
   map), billing_customers (Connect account id, customer id, identity status — verify with Stripe
   accounts.retrieve/customers.retrieve; report missing), events -> event_types (slug preserved),
   schedules + availabilities -> schedules + availability_rules, blocked dates -> date_overrides,
   scheduling settings -> expert defaults, meetings -> bookings (+ sessions for future ones,
   status map; drop Meet links) + booking_payments, payment transfers + transaction commissions ->
   payout_states (status map, transfer ids, applied_commission_bps), subscription plans/events/
   annual eligibility -> billing_subscriptions + commission_override_bps/expiry per
   infra/migration/GRANDFATHER.md (write this table and get finance approval recorded in
   decision-log.md), records -> records (decrypt via WorkOS Vault, sha256 into
   migration_checksums, re-encrypt with encryptForOrg(expertOrgId), kind note|report), audit logs
   -> audit project legacy_audit_events via @eleva/audit bulk import. Google Calendar tokens are
   dropped; queue notification kind calendar.reconnect_required for affected experts (sent at
   cutover).
4. verify.ts: per-table source vs target counts with tolerances (0 for users, experts, bookings,
   payments, records), FK orphan scan, checksum match ratio (must be 100%), sample login test
   (issue magic links for 5 experts on staging and assert session creation via the API), public
   URL resolution test for 20 random /[username]/[eventSlug]. report.ts renders JSON + Markdown.
5. Welcome campaign: @eleva/email template migration.welcome (pt/en/es): explains the new
   platform, set-password/magic link, Google sign-in note, calendar reconnect; sender in waves
   with suppression of bounced addresses; dry-run prints recipients only.
6. URL compatibility: redirect map module in @eleva/config (or apps/web next.config) for MVP
   routes -> v3 (appointments -> /app/*, expert dashboard -> /expert/*, legacy locale paths),
   with tests; keep /[locale]/[username] and /[locale]/[username]/[eventSlug] identical.
7. Rehearsals: run pnpm migration:rehearse three times (fixing mappers between runs), commit
   infra/migration/reports/*.md, and time the run. Write operator-tasks/cutover-runbook.md with
   the freeze procedure (MVP read-only banner + booking disabled, verify no pending Multibanco,
   final --since delta run, verify, DNS switch, Stripe webhook switch, welcome wave 1, rollback =
   DNS revert + MVP unfreeze) including owners and expected durations.
8. Tests: mapping unit tests (roles, org types, payout states, slug preservation, checksum
   round trip), redirect map tests. Docs: ADR-019 final, launch-readiness-checklist.md,
   data-retention-export-matrix.md (legacy audit retention), decision-log.md.

Acceptance (paste evidence): three rehearsal reports committed with counts/checksums within
tolerance; idempotent re-run no-op; migrated expert signs in and sees history on staging;
records decrypt; Stripe verification 100%; rollback rehearsal timed; welcome dry-run output.

Report: mapper list, report summaries, remaining warnings, CodeRabbit CLI counts, PR URL,
operator prerequisites for Phase 15 (MVP read-only role, WorkOS key retention, DNS TTL lowering).
```
