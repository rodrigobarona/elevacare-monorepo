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
  **v3 production Neon project** (`NEON_PROJECT_ID`) on a **non-default branch** — rehearsal
  branches are created in the production project so they carry the real schema, roles and
  extensions; the staging project is never a migration target — and that also appears in the
  `MIGRATION_ALLOWED_TARGET_HOSTS` allowlist. Rehearsals therefore cannot write to the production
  (default) branch by accident. One project, one guard: the same `NEON_PROJECT_ID` is used by the
  guard, the env docs, `migration:rehearse` and the guard tests.
- **Entity mapping** (MVP `drizzle/schema.ts` -> v3):
  - `UsersTable` -> `auth.user` (email, emailVerified, name, image, `locale`, `country`,
    `timezone`, createdAt) + `auth.account` provider `credential` **without** password (forces
    set-password) and provider `google` **only when the original Google subject is known**: the
    export step calls WorkOS `userManagement.getUserIdentities(workosUserId)` (while WorkOS is
    still live) and stores `{ provider: "GoogleOAuth", idp_id }` in the source snapshot; the
    mapper writes `auth.account { providerId: "google", accountId: idp_id }` from that subject —
    **never** by matching the e-mail. Users whose snapshot has no identity get no `google` row;
    they sign in with the magic link and Better Auth `accountLinking` (`trustedProviders:
["google"]`, verified e-mail required) links Google explicitly at their next Google sign-in;
    MVP roles (`user`, `top_expert`, `community_expert`, `admin`, `superadmin`) -> admin plugin role
    (`platform_admin` for superadmin/admin) + expert profile flags.
  - `OrganizationsTable` + `UserOrgMembershipsTable` -> `auth.organization` (`patient_personal`
    -> `personal` Space named `{firstName}'s Space`; `expert_individual` -> `expert`; `clinic` ->
    `team`) + `auth.member` (owner/admin/member).
  - `ProfilesTable`, `CategoriesTable`, `ExpertSetupTable`, `ExpertApplicationsTable` ->
    `expert_profiles`, `expert_categories`, `expert_listings`, `become_partner_applications`
    (status mapped), `billing_customers` (Stripe Connect account id, customer id, identity status).
  - `EventsTable` -> `event_types` **plus exactly one `event_type_modes` row** per event (MVP
    events are single-mode: `online` unless the MVP location field says otherwise; for a physical
    MVP location the migrator first resolves or creates the matching `expert_practice_locations`
    row from the MVP address fields — keyed in `migration_id_map` by the MVP location string — and
    sets `location_id` on the `in_person` mode; an address that cannot be parsed into
    `(country, city, address_line)` is a hard mapping error listed in the rehearsal report, never a
    location-less in-person mode; `schedule_id` = the expert's default schedule; `country_scope` =
    `[practice_country]` for clinical, `worldwide` for non-clinical, `[location.country]` for
    in-person; languages = the MVP event languages; fixture: one online, one phone and one
    physical-location MVP event), `expert_profiles.practice_country` /
    `service_countries` / `languages` from the MVP profile (slug preserved for URL compatibility),
    `SchedulesTable` +
    `ScheduleAvailabilitiesTable` -> `schedules` + `availability_rules`, `BlockedDatesTable` ->
    `date_overrides`, `SchedulingSettingsTable` -> expert scheduling defaults.
  - `MeetingsTable` -> `bookings` (each booking snapshots the resolved mode of its event —
    `event_type_mode_id`, `mode` (`online|phone|in_person`), `location_id`, `language` — so the
    Phase 8 templates and the Phase 9 online-only room sweep read the right values; fixtures cover
    all three modes; + `sessions` for future **online** meetings only; Meet links dropped; Daily
    rooms created by the Phase 9 sweep after cutover) + `booking_payments` (payment intent id, amounts,
    fee), `PaymentTransfersTable` + `TransactionCommissionsTable` -> `payout_states` (status
    mapping, transfer ids, `applied_commission_bps` from the ledger), `SlotReservationsTable`
    dropped (expired), `SubscriptionPlansTable` + `SubscriptionEventsTable` +
    `AnnualPlanEligibilityTable` -> `billing_subscriptions` + grandfather flags
    (`commission_override_bps` with expiry per finance mapping table).
  - `RecordsTable` -> `records` (kind `note|report`), decrypted from WorkOS Vault using the MVP's
    `@workos-inc` Vault client **in the migration package only** (temporary, isolated dependency)
    and re-encrypted with `encryptForOrg(expertOrgId)`; checksums stored in
    `migration_checksums` as HMAC-SHA-256 of the plaintext under a migration-only key
    (`MIGRATION_CHECKSUM_KEY`, held outside the database, never `ELEVA_KEK_*`) — a bare SHA-256
    would let anyone with table access confirm guesses of clinical notes or templates offline; the
    key is destroyed after the Phase 15 final verification, at which point the rows become
    unverifiable noise and are dropped with the migration schema at +30 days.
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
  logins via magic link in staging), produce report under `infra/migration/reports/rehearsal-YYYY-MM-DD.md`
  (committed). Three rehearsals required; the last within 3 days of cutover.
- **Freeze plan** (executed in Phase 15): MVP read-only banner + disabled booking, drain pending
  Multibanco (> 8 days rule means none should exist within 24h — verify), final delta run,
  verification, DNS switch.

Out: cutover itself (Phase 15).

## Deliverables

1. `infra/migration/{package.json,README.md,src/{cli.ts,source.ts,target.ts,map/*.ts,verify.ts,report.ts},reports/}`; `source.ts` also exports WorkOS user identities (`getUserIdentities`) into the snapshot while WorkOS is still reachable.
2. `migration_runs`, `migration_id_map` (unique on source table + source id + target table +
   target kind, because one MVP row can fan out into several v3 rows — e.g. `UsersTable` ->
   `auth.user` + `auth.account/credential` + optional `auth.account/google`), `migration_checksums`
   (unique on target table + target id, upserted) tables in a `migration` schema on v3, dropped
   after Phase 15 + 30 days.
3. Welcome campaign template + sender script (`migration:send-welcome --wave 1 --size 500`;
   waves persisted in `migration_welcome_waves` so re-running a wave is a no-op).
4. Redirect map + tests.
5. Three committed rehearsal reports; finance-approved grandfather mapping table
   (`infra/migration/GRANDFATHER.md`).
6. Runbook `docs/eleva-v3/operator-tasks/cutover-runbook.md` (used by Phase 15).

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
- [ ] Rollback rehearsal on staging equivalents, timed: v3 write freeze,
      `pnpm migration:reverse-export --since "$CUTOVER_TS"` produces a signed JSON of the complete
      post-cutover mutation set (inserts, updates and deletes; schema-derived table inventory), each entity class restored per the
      five-action table in the runbook,
      Stripe-driven reconciliation replays every succeeded PaymentIntent missing from MVP exactly
      once (idempotent on `stripe_payment_intent_id`), MVP webhook re-enabled, DNS revert + MVP
      unfreeze. Zero duplicates and zero lost paid bookings in the rehearsal report.

## Tests

- vitest on mapping functions (role mapping, org type mapping, payout state mapping, slug
  preservation, checksum), redirect map.

## Docs to update

- ADR-019 (final), `docs/eleva-v3/operator-tasks/cutover-runbook.md`, `docs/eleva-v3/launch-readiness-checklist.md`,
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
   and .cursor/skills/{audit-wiring,coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/14-mvp-migration.md in full.
3. Read every file under "Local references" — the MVP drizzle/schema.ts end to end and the v3
   schema. Pull Neon branching/PITR, Stripe retrieve APIs, WorkOS Vault decrypt and Better Auth
   account linking docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 14 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-14/mvp-migration
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
  or the review cap is reached (README section 4 rule 4: max 3 rounds, zero Critical/Major left,
  remaining Minor/Trivial listed in the PR body "Deferred findings" table with a reason each).
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean or
  the cap (max 2 rounds, same exit rule).
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green
  (after 2 App rounds escalate leftovers to the reviewer — README section 4 rule 6); request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.
- Never run --apply against production in this phase. Rehearsals run on Neon branches only.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for every app's required locales (pt/en/es; apps/admin
pt/en only — decision-log staff-only exception), cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 14 TASK — MVP -> v3 data migration tooling and three rehearsals (ADR-019).

1. Create infra/migration (@eleva/infra-migration, tsx, isolated deps incl. @workos-inc/node for
   Vault decrypt and identity export ONLY here). Update the Phase 3 guards for this single
   exception: (a) .github/workflows/ci.yml step "legacy-idp-guard" (Phase 3) adds --glob '!infra/migration/**' to
   its rg command (and nothing else); (b) packages/eslint-config/boundaries.js keeps forbidding
   @workos-inc/* everywhere and adds an allow entry scoped to infra/migration/**; (c) a new CI step
   "no-migration-imports" fails if any file under apps/** or packages/** imports
   @eleva/infra-migration or anything under infra/migration. Tests: the legacy-idp-guard rg with the new
   glob returns nothing on this branch; a deliberate `import "@workos-inc/node"` in packages/auth
   fails boundary lint; a deliberate import of infra/migration from apps/api fails the new step.
   Phase 16.16 removes the package and both exceptions. CLI (every flag has a concrete default so
   the commands below run as written): pnpm migration:run --dry-run|--apply
   [--target branch|production] [--since "$LAST_RUN_TS"] (ISO-8601; omitted = full run; the
   watermark is a **commit-ordered source** boundary, never the target run end time: the CLI
   opens one REPEATABLE READ snapshot on the MVP database at the start of the run, records the
   snapshot's `now()` as `source_watermark` and `pg_export_snapshot()` as `source_snapshot_id`
   (the snapshot identity every reader worker imports with SET TRANSACTION SNAPSHOT so all
   tables are read from the same consistent view; `pg_current_wal_lsn()` is also stored as
   `source_wal_lsn` but is **informational only** — it is the current write position, not the
   snapshot boundary, and is never used as a delta or cutover boundary), and reads every table
   from that snapshot; because a row's `updated_at` is
   set at statement time while its commit can land after the snapshot, a delta run selects
   `updated_at >= source_watermark - MIGRATION_DELTA_OVERLAP` (default 15 min) and relies on the
   idempotent upsert mappers to make the overlap harmless, and the CLI asserts at snapshot time
   that no MVP transaction older than the overlap is in flight
   (`pg_stat_activity.xact_start`, read-only role) — otherwise it aborts with the offending pid
   so the operator widens the overlap; the **final** cutover delta is exact by construction
   because Phase 15 runs it only after the MVP is read-only (writes frozen, so no in-flight
   commit can be missed). The same two values are written to
   infra/migration/reports/last-run.json; the operator exports source_watermark as LAST_RUN_TS
   before a delta run) [--report FILE] (default
   infra/migration/reports/run-$(date -u +%Y%m%dT%H%M%SZ).md);
   pnpm migration:verify; pnpm migration:rehearse (creates a Neon branch of the v3 *production*
   project — empty of tenant data before cutover, so the branch carries the real production
   schema, roles and extensions — restores a fresh pg_dump of the MVP production database (taken
   with the read-only role) into schema legacy via pg_restore, runs run --apply --target branch,
   then verify, then writes infra/migration/reports/rehearsal-$(date -u +%F).md; staging
   snapshots are never a rehearsal input); pnpm migration:send-welcome --wave 1 --size 500
   (--wave is the 1-based wave number persisted in migration_welcome_waves so a re-run of the same
   wave is a no-op; --size defaults to 500). Env: MVP_DATABASE_URL (read-only role),
   TARGET_DATABASE_URL, WORKOS_API_KEY
   (Vault read), STRIPE_SECRET_KEY, ELEVA_KEK_V1, MIGRATION_CHECKSUM_KEY (32 random bytes,
   generated per migration, stored only in the operator vault), MIGRATION_ALLOWED_TARGET_HOSTS.
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
   since, source_watermark timestamptz NOT NULL, source_snapshot_id text NOT NULL (both from the
   MVP snapshot in item 1; printed by migration:verify and included in every report — Phase 15
   reads source_watermark as LAST_REHEARSAL_TS and applies the same overlap), source_wal_lsn
   pg_lsn (informational only), overlap_seconds int NOT NULL, stats jsonb, status), migration_id_map (source_table, source_id, target_table,
   target_kind, target_id, unique(source_table, source_id, target_table, target_kind) —
   target_kind is a mapper-defined discriminator, e.g. "user", "account:credential",
   "account:google", "member:personal-space", so a source row that fans out into several target
   rows has one map row per output), migration_checksums (target_table, target_id, hmac_sha256,
   key_version, unique(target_table, target_id) — checksum rows are upserted on that key so a
   repeated --apply is a no-op for checksums too). Every mapper is idempotent through
   migration_id_map (lookup by the full key before insert; upsert on conflict); tests run --apply
   twice on a fixture and assert identical row counts in every target table including
   migration_checksums, and specifically that a user with credential + google accounts yields
   exactly one auth.user and two auth.account rows after both runs.
3. Mappers in src/map/*.ts, run in dependency order: users (UsersTable -> auth.user + auth.account
   credential row without password + google account ONLY from the exported WorkOS identity
   idp_id as accountId — no e-mail matching; missing identity -> no row, rely on Better Auth
   accountLinking trustedProviders ["google"] at first sign-in; roles -> admin plugin
   role platform_admin for admin/superadmin; locale/country/timezone), organizations
   (patient_personal -> personal Space `${firstName}'s Space`; expert_individual -> expert;
   clinic -> team) + memberships -> auth.member, expert profiles/categories/listings/applications
   -> expert_profiles, expert_categories, expert_listings, become_partner_applications (status
   map), billing_customers (Connect account id, customer id, identity status — verify with Stripe
   accounts.retrieve/customers.retrieve; report missing), events -> event_types + one
   event_type_modes row each (mode from the MVP location field, default schedule, country scope
   from kind — see Scope) and MVP profile country/languages -> expert_profiles practice scope
   (slug preserved),
   schedules + availabilities -> schedules + availability_rules, blocked dates -> date_overrides,
   scheduling settings -> expert defaults, meetings -> bookings (+ sessions for future ones,
   status map; drop Meet links) + booking_payments, payment transfers + transaction commissions ->
   payout_states (status map, transfer ids, applied_commission_bps), subscription plans/events/
   annual eligibility -> billing_subscriptions + commission_override_bps/expiry per
   infra/migration/GRANDFATHER.md (write this table and get finance approval recorded in
   decision-log.md), records -> records (decrypt via WorkOS Vault, HMAC-SHA-256 of the plaintext
   with MIGRATION_CHECKSUM_KEY into migration_checksums — never a plain hash —, re-encrypt with
   encryptForOrg(expertOrgId), kind note|report), audit logs
   -> audit project legacy_audit_events via @eleva/audit bulk import. Google Calendar tokens are
   dropped; queue notification kind calendar.reconnect_required for affected experts (sent at
   cutover).
4. verify.ts: per-table source vs target counts with tolerances (0 for users, experts, bookings,
   payments, records), FK orphan scan, checksum match ratio (must be 100%), sample login test
   (issue magic links for 5 experts on staging and assert session creation via the API), public
   URL resolution test for 20 random /[username]/[eventSlug]. report.ts renders JSON + Markdown.
5. Welcome campaign: @eleva/email template migration.welcome (pt/en/es): explains the new
   platform, set-password/magic link, Google sign-in note (works immediately when the subject was
   migrated, otherwise sign in with the magic link once and Google links on the next sign-in),
   calendar reconnect; sender in waves
   with suppression of bounced addresses; dry-run prints recipients only.
6. URL compatibility: redirect map module in @eleva/config (or apps/web next.config) for MVP
   routes -> v3 (appointments -> /app/*, expert dashboard -> /expert/*, legacy locale paths),
   with tests; keep /[locale]/[username] and /[locale]/[username]/[eventSlug] identical.
7. Rehearsals: run pnpm migration:rehearse three times (fixing mappers between runs), commit
   infra/migration/reports/*.md, and time the run. Write docs/eleva-v3/operator-tasks/cutover-runbook.md with
   the freeze procedure (MVP read-only banner + booking disabled, verify no pending Multibanco,
   final --since delta run, verify, DNS switch, Stripe webhook switch, welcome wave 1) and a
   "Rollback" section that preserves post-cutover writes: freeze v3 writes -> pnpm
   migration:reverse-export --since "$CUTOVER_TS" (implement in infra/migration: dumps the COMPLETE
   post-cutover mutation set — EVERY tenant table's rows with created_at or updated_at after the
   timestamp (so updates to pre-cutover bookings, users, invoices and payment state are included,
   each tagged op = insert|update by comparing created_at with the timestamp), soft-deletes, and
   hard deletes reconstructed from audit_events rows with action deleted after the timestamp
   (tagged op = delete with the entity id) — to a JSON file signed with an HMAC under
   MIGRATION_CHECKSUM_KEY; the restore side needs a stable MVP key for EVERY exported record, so
   add rollback_id_map (v3_table, v3_id, mvp_table, mvp_id, unique on the v3 pair and on the MVP
   pair): rows migrated forward are seeded by inverting migration_id_map at cutover; a v3 insert
   with no MVP source gets its MVP id assigned on first replay and recorded there, so the second
   replay of the same record finds the mapping and upserts instead of inserting again; updates
   and deletes resolve their MVP target through the same map (never by e-mail or by natural
   keys). Replay = upsert for insert|update, delete-or-tombstone for delete; re-running the
   replay is a no-op precisely because rollback_id_map is consulted first — a rehearsal test
   inserts, edits and deletes v3 rows, replays twice, and asserts one MVP row per v3 row and the
   final state reflected; the entity inventory is generated
   from the Drizzle schema so a new table cannot be forgotten, and a unit test fails if a table
   with created_at/updated_at is missing from the export). Restore per entity class, in this
   order: (1) identity — auth.user/account/organization/member created after cutover are
   re-created in the MVP through the WorkOS Management API (createUser + organization membership)
   and receive a magic link; (2) money — bookings, booking_payments, payout_states, invoices
   reconciled with Stripe as source of truth (every succeeded PaymentIntent has exactly one
   canonical active booking, replayed into MVP via its booking importer keyed on
   stripe_payment_intent_id; never auto-refund); (3) bookings state — cancellations and
   reschedules applied to the MVP rows by booking id map; (4) profiles, preferences, consents
   upserted into the MVP tables that exist for them; (5) entity types with no MVP equivalent
   (records, session_documents, session_participants, CRM, notifications) are NOT restored into
   the MVP — they stay in the read-only v3 database and the signed export, and are re-imported
   when v3 relaunches with a forward --since run. The runbook lists this per-entity action table
   explicitly and the acceptance criterion is: zero lost paid bookings, every post-cutover row
   present in the signed export, and each entity class mapped to one of the five actions above.
   -> re-enable MVP Stripe webhook -> DNS revert -> MVP unfreeze. Include owners and expected
   durations for every step.
8. Tests: mapping unit tests (roles, org types, payout states, slug preservation, checksum
   round trip), redirect map tests. Docs: ADR-019 final, launch-readiness-checklist.md,
   data-retention-export-matrix.md (legacy audit retention), decision-log.md.

Acceptance (paste evidence): three rehearsal reports committed with counts/checksums within
tolerance; idempotent re-run no-op; migrated expert signs in and sees history on staging;
records decrypt; Stripe verification 100%; rollback rehearsal timed; welcome dry-run output.

Report: mapper list, report summaries, remaining warnings, CodeRabbit CLI counts, PR URL,
operator prerequisites for Phase 15 (MVP read-only role, WorkOS key retention, DNS TTL lowering).
```
