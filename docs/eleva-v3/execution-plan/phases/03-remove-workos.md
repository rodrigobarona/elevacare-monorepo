# Phase 3 — WorkOS removal: envelope encryption, calendar credentials, billing seats, dashboard, infra

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-03/remove-workos`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Depends on | Phase 2                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Effort     | 1.5 weeks                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Touches    | `packages/encryption/**`, `packages/calendar/**`, `packages/billing/src/server/provisioning.ts`, `packages/workflows/src/scheduling/calendar-event-sync.ts`, `packages/dashboard/**`, `packages/eslint-config/boundaries.js`, `apps/api/src/app/workos/**`, `apps/expert/**` (integrations UI), `infra/workos/**`, `infra/qstash/**`, `infra/stripe/**`, `pnpm-workspace.yaml`, `.env.example`, `turbo.json`, `.github/workflows/ci.yml` |
| Exit gate  | `rg -n "workos" -i --glob '!_context/**' --glob '!docs/eleva-v3/adrs/**' --glob '!docs/eleva-v3/decision-log.md' --glob '!docs/eleva-v3/execution-plan/**' --glob '!pnpm-lock.yaml' --glob '!.github/workflows/**'` returns nothing; CI guard blocks `@workos-inc` imports; calendar connect works via Better Auth tokens; envelope encryption tests green                                                                               |

## Why this phase exists

After Phase 2, identity runs on Better Auth but WorkOS still powers Vault (record/token
encryption), Pipes (Google/Microsoft calendar tokens), the seat meter in billing provisioning,
QStash `workos-sync`, and infra scripts. This phase removes every remaining dependency so WorkOS
can be cancelled after the Phase 14 record export.

## Scope

In:

- `@eleva/encryption` rewrite (ADR-020): `encryptForOrg(orgId, plaintext, aad?)`,
  `decryptForOrg(orgId, ciphertext, aad?)`, `getOrCreateOrgDek(orgId)`, `rotateKek(fromVersion,
toVersion)`, `shredOrgKeys(orgId)`; KEKs from `ELEVA_KEK_V<n>`; `org_data_keys` table (added
  in Phase 2); ciphertext format `v1:<kek_v>:<dek_v>:<iv>:<tag>:<data>`; delete `vault.ts`,
  `client.ts` (WorkOS), `tokens.ts` if it wraps Vault; keep a `records.ts` helper API for PHI
  fields (`encryptRecordFields`, `decryptRecordFields`).
- `@eleva/auth` exports `getProviderAccessToken({ providerId, accountId, userId })` (wraps
  `auth.api.getAccessToken`, Better Auth auto-refreshes) — the **only** place the Better Auth
  token API is called, so the `better-auth`-only-in-`packages/auth` boundary holds.
  `@eleva/calendar` `credential-manager.ts` receives that function by injection
  (`createCredentialManager({ getProviderAccessToken })`) and never imports `better-auth`; scope
  upgrades start with the `@eleva/auth/client` `linkSocial({ provider, scopes })` wrapper from
  the expert integrations UI; Google
  scopes `calendar.readonly` + `calendar.events`; Microsoft `Calendars.ReadWrite`; store the
  Better Auth `account.id` on `expert_integrations` (replace `workos_user_id`).
- `packages/workflows/src/scheduling/calendar-event-sync.ts` uses the new credential manager.
- `@eleva/billing` `provisioning.ts`: `syncSeatQuantity(orgId)` implements the single seat rule
  that Phase 11 relies on — billable seat = a membership of an organization with
  `organization.type = 'team'` (the product label is "Team (Clinic)"; `team` is the only
  seat-billed type — never `personal` or `expert`) (any role, owner included) whose user has at
  least one _published_ event type in that org; owner/admin accounts without published event
  types are free. Triggered from `organizationHooks.afterAddMember`,
  `organizationHooks.afterAcceptInvitation` and `organizationHooks.afterRemoveMember` (registered
  in Phase 2 as stubs) **and** from the event-type publish/unpublish path in `@eleva/scheduling`
  (test: a member with a published event type who is removed and re-invited drops the quantity on
  removal and restores it on `afterAcceptInvitation` without any publish); until Phase 11 creates team
  subscriptions the function is a no-op for orgs without a `billing_subscriptions` row. Remove
  the WorkOS meter.
- `apps/api/src/app/workos/sync` deleted; `infra/qstash/setup-workos-sync.ts` deleted and
  `setup-all.ts` updated; QStash schedule removed in Upstash (`pnpm qstash:list` to verify).
- `infra/workos/` deleted; root scripts `workos:*` removed; `infra/stripe/backfill-org-customers.ts`
  and `verify-entitlements.ts` updated to read orgs from `auth.organization`;
  `packages/db/scripts/backfill-org-slugs.ts` updated or deleted.
- `apps/account/src/components/workos-widgets-provider.tsx` and `settings-widgets.tsx` deleted
  (replaced in Phase 2); `apps/*/package.json` drop `@workos-inc/*` **and** `@radix-ui/themes`
  (the WorkOS Widgets peer kept transitionally by ADR-022 — also remove it from the
  `pnpm-workspace.yaml` catalog, delete `packages/dashboard/src/workos-widgets-{config.ts,overrides.css}`
  and the `import "@radix-ui/themes/styles.css"` lines in org-scoped layouts; `rg radix` must
  return only ADR/decision-log history); catalog entries removed;
  `packages/eslint-config/boundaries.js` forbids `@workos-inc/*` everywhere and enforces
  `better-auth` only in `packages/auth`.
- `.github/workflows/ci.yml`: `legacy-idp-guard` step (`rg` returns non-zero).
- `.env.example`, `turbo.json`, `environment-matrix.md`: remove `WORKOS_*`; add `ELEVA_KEK_V1`.
- Expert integrations UI (`apps/expert`): connect Google/Microsoft buttons call `linkSocial` with
  calendar scopes and return to the integrations page; status reads from `expert_integrations`.

Out: records/PHI features (Phase 10); MVP record re-encryption (Phase 14).

## Deliverables

1. `packages/encryption/src/{index,envelope,keys,records}.ts` + tests with known vectors and
   rotation/shred tests.
2. `packages/calendar/src/credential-manager.ts` rewritten; adapters unchanged.
3. `packages/billing/src/server/provisioning.ts` seat sync from Better Auth members + test.
4. Deletions: `apps/api/src/app/workos/`, `infra/workos/`, `infra/qstash/setup-workos-sync.ts`,
   `packages/encryption/src/{vault,client}.ts`, `apps/account/src/components/workos-widgets-provider.tsx`,
   `apps/account/src/app/account/(shell)/settings/settings-widgets.tsx`, `.cursor` leftovers.
   `packages/auth/README.md` is kept and rewritten (WorkOS sections removed, Better Auth
   sections from Phase 2 stay) — see "Docs to update".
5. Boundary lint + CI guard.
6. Env/docs updates.

## Acceptance criteria

- [ ] Exit-gate grep returns nothing; `pnpm install` has no `@workos-inc` in `pnpm-lock.yaml`.
- [ ] `encryptForOrg`/`decryptForOrg` round trip; tampered tag fails; `rotateKek` re-wraps DEKs and
      old ciphertext still decrypts; `shredOrgKeys` makes ciphertext unrecoverable (test).
- [ ] Expert connects Google Calendar from `apps/expert` integrations page -> busy sources listed
      -> destination calendar selectable -> `calendar-event-sync` creates an event on a test
      booking (manual verification on staging).
- [ ] Adding/removing a member in a Team org updates Stripe subscription quantity (test with
      Stripe test clock or mocked client).
- [ ] QStash `workos-sync` schedule gone (`pnpm qstash:list`).
- [ ] CI `legacy-idp-guard` step green; boundary lint fails on a deliberate `@workos-inc` import (verify
      locally, then remove).

## Tests

- vitest: `envelope.test.ts`, `keys.test.ts`, `records.test.ts`, `credential-manager.test.ts`
  (mock `auth.api.getAccessToken`), `provisioning.test.ts`.

## Docs to update

- `calendar-integration-spec.md`, `compliance-data-governance.md` (encryption section),
  `integration-runbooks.md` (KEK rotation runbook), `environment-matrix.md`, `AGENTS.md`,
  `decision-log.md`, `infra/qstash/README.md`, `packages/auth/README.md`,
  `packages/encryption/README.md`.

## Local references

- `packages/encryption/src/*`, `packages/calendar/src/credential-manager.ts`,
  `packages/calendar/src/adapters/**`, `packages/workflows/src/scheduling/calendar-event-sync.ts`,
  `packages/billing/src/server/provisioning.ts`, `packages/dashboard/src/*`,
  `packages/eslint-config/boundaries.js`, `infra/workos/**`, `infra/qstash/**`, `infra/stripe/**`,
  `apps/expert/src/app/**/integrations/**`, `apps/api/src/app/experts/integrations/**`.
- ADR-020, ADR-004, `calendar-integration-spec.md`.

## External docs

- Better Auth `/better-auth/better-auth`: `getAccessToken`, `linkSocial` with scopes,
  `encryptOAuthTokens`, organization hooks.
- Node crypto (AES-256-GCM) — MDN/Node docs; Drizzle `bytea` handling `/drizzle-team/drizzle-orm`.
- Google Calendar API scopes; Microsoft Graph calendar permissions (official docs).
- Stripe subscriptions quantity updates `/websites/stripe` (subscription items, proration).

## Risks

- Existing encrypted test data in staging becomes unreadable: staging is reset in this phase
  (document in PR); production MVP data is handled in Phase 14.
- Google verification for sensitive scopes: keep the OAuth consent screen in testing mode until
  Phase 15; document in `integration-runbooks.md`.

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (better-auth.mdc, encryption.mdc, audit-wiring.mdc,
   stripe-webhooks.mdc) and the matching skills, plus .cursor/skills/coderabbit-review/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/03-remove-workos.md in full.
3. Read every file under "Local references". Pull Better Auth (getAccessToken, linkSocial,
   organization hooks), Drizzle, Stripe subscriptions docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 3 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-03/remove-workos
- Keep under 150 reviewable files (deletions count); split into phase-03.1/encryption-calendar and
  phase-03.2/infra-cleanup if needed.
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

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for every app's required locales (pt/en/es; apps/admin
pt/en only — decision-log staff-only exception), cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 3 TASK — Remove every remaining WorkOS dependency (ADR-017, ADR-020).

1. @eleva/encryption (packages/encryption): implement envelope encryption.
   - keys.ts: loadKeks() reads ELEVA_KEK_V<n> env vars (base64, 32 bytes), current version =
     highest n; never log key material. getOrCreateOrgDek(orgId) is race-safe: org_data_keys has
     unique (org_id, dek_version) and a partial unique index on org_id WHERE active = true; the
     function reads the active row (RLS via withOrgContext) and returns it, otherwise generates a
     32-byte DEK, wraps it with the current KEK (AES-256-GCM, iv 12 bytes, aad =
     orgId:key_version) and INSERTs ... ON CONFLICT DO NOTHING with withAudit (entity
     "org_data_key", action "created"), then re-reads the active row and returns the winner —
     so two first-use requests never end up with different DEKs and never surface a unique
     violation. Test: 20 concurrent getOrCreateOrgDek(orgId) calls resolve to one row and one
     audit event.
   - envelope.ts: encryptForOrg(orgId, plaintext: Uint8Array|string, aad?) ->
     "v1:<kek_v>:<dek_v>:<iv_b64>:<tag_b64>:<data_b64>"; decryptForOrg(orgId, ciphertext, aad?)
     parses, unwraps the referenced DEK version, decrypts, throws typed EncryptionError on tag
     mismatch or missing key. rotateKek(from, to) re-wraps every active DEK (batch, idempotent).
     shredOrgKeys(orgId) DELETES every org_data_keys row for the org inside one transaction
     (ADR-020 crypto-shred = delete DEK rows; nothing is retained, not even a tombstone with a
     null wrapped_dek) and emits one audit event per deleted key version (entity "org_data_key",
     action "shredded", payload { orgId, keyVersion, kekVersion } — the audit trail, not the
     table, is the evidence). decryptForOrg on ciphertext whose DEK row no longer exists throws
     EncryptionError("KEY_SHREDDED") — never a generic tag mismatch — so callers can render the
     "content permanently deleted" state.
   - records.ts: encryptRecordFields(orgId, obj, fields[]) / decryptRecordFields for PHI objects.
   - Delete vault.ts, client.ts, tokens.ts (if Vault-backed) and their tests; README rewritten.
   - Tests: known-vector round trip, tamper detection, aad mismatch, rotation keeps old ciphertext
     readable, shred makes it unreadable, KEK missing -> clear error.
2. @eleva/calendar credential-manager.ts: replace WorkOS Pipes with Better Auth WITHOUT importing
   better-auth in packages/calendar (boundary: better-auth only in packages/auth). Add to
   @eleva/auth: getProviderAccessToken({ providerId, accountId, userId }) wrapping
   auth.api.getAccessToken (auto refresh) — the single call site of that API. In @eleva/calendar
   export createCredentialManager({ getProviderAccessToken }) (dependency injection; apps/api and
   @eleva/workflows construct it with the @eleva/auth function) whose getProviderToken
   ({ userId, provider, accountId }) delegates to it with accountId =
   expert_integrations.auth_account_id — always pass it so a user with several linked accounts
   for the same provider gets the calendar they connected; unit tests use a fake
   getProviderAccessToken. Expose startScopeUpgradeUrl(provider) from @eleva/auth/client for the
   UI (linkSocial with calendar scopes:
   google https://www.googleapis.com/auth/calendar.readonly + calendar.events; microsoft
   Calendars.ReadWrite offline_access). expert_integrations: replace workos_user_id with
   auth_account_id (FK auth.account.id); migration in packages/db. Update adapters only where they
   receive tokens. Update packages/workflows/src/scheduling/calendar-event-sync.ts accordingly.
   apps/expert integrations page: Connect Google / Connect Microsoft buttons call the linkSocial
   flow via @eleva/auth/client with callbackURL back to the integrations page; status badge reads
   expert_integrations. apps/api experts/integrations routes: remove WorkOS references.
3. @eleva/billing provisioning.ts: seat sync with the single seat rule shared with Phase 11.
   Implement syncSeatQuantity(orgId): no-op unless organization.type = 'team' (the only
   seat-billed type; personal/expert orgs return early). Seats = count of memberships of that
   team org (any role, owner included) whose user has >= 1 published event type in that org.
   Put the SQL in one @eleva/db query helper countBillableSeats(orgId) that joins per member —
   auth.member -> expert_profiles (org_id = team org, user_id = member) -> event_types
   (expert_profile_id = profile, org_id = team org, published = true, active = true) and counts
   DISTINCT user_id — never an org-level "any published event type exists" check, which would
   bill every member once one publishes. Owner/admin accounts without their own published event
   types are not seats (test the zero-seat owner case); no-op when the org has no
   billing_subscriptions row;
   otherwise update the Stripe subscription seat item quantity (proration per
   payments-payouts-spec.md). Wire it into the organization plugin hooks afterAddMember /
   afterRemoveMember / afterAcceptInvitation defined in packages/auth/src/server/auth.ts (import
   from @eleva/billing/server — check for circular deps; if needed, publish an event through
   @eleva/workflows) AND into the event-type publish/unpublish mutation in @eleva/scheduling.
   Tests with a mocked Stripe client: owner without event types = 0 seats; publish -> +1;
   unpublish -> -1; remove member -> -1.
4. Deletions: apps/api/src/app/workos/, infra/workos/ (whole package), infra/qstash/
   setup-workos-sync.ts (+ update setup-all.ts, README, root scripts qstash:setup:workos-sync,
   workos:rbac:generate, workos:widgets:generate), apps/account/src/components/
   workos-widgets-provider.tsx, apps/account/src/app/account/(shell)/settings/settings-widgets.tsx
   and any WorkOS import left in apps/account (layout.tsx, onboarding/page.tsx), packages/dashboard
   env.d.ts WorkOS vars, infra/stripe/backfill-org-customers.ts and verify-entitlements.ts
   (rewrite to read auth.organization), packages/db/scripts/backfill-org-slugs.ts (rewrite or
   delete). Remove @workos-inc/* from every package.json and from the pnpm catalog; run
   pnpm install and commit the lockfile. Remove the QStash workos-sync schedule in Upstash via the
   infra/qstash scripts and verify with pnpm qstash:list.
5. Guards: packages/eslint-config/boundaries.js -> forbid @workos-inc/* everywhere; allow
   better-auth only in packages/auth; allow @daily-co/* only in packages/video (prepare).
   .github/workflows/ci.yml -> step "legacy-idp-guard": `! rg -n -i "workos" --glob '!_context/**'
   --glob '!docs/eleva-v3/adrs/**' --glob '!docs/eleva-v3/decision-log.md'
   --glob '!docs/eleva-v3/execution-plan/**' --glob '!pnpm-lock.yaml'
   --glob '!.github/workflows/**'` — the workflow file itself contains the literal (step name and
   pattern), so without the last glob the guard matches itself and fails on every run; the step
   name deliberately avoids the literal too. Same glob list in the exit-gate command above.
6. Env + docs: remove WORKOS_* from .env.example, turbo.json globalEnv, environment-matrix.md and
   AGENTS.md; add ELEVA_KEK_V1 (generation command: openssl rand -base64 32) and a KEK rotation
   runbook in integration-runbooks.md; update calendar-integration-spec.md,
   compliance-data-governance.md, packages/encryption/README.md, packages/auth/README.md,
   infra/qstash/README.md, decision-log.md. Tell the owner which Vercel env vars to delete/add.

Acceptance: exit-gate grep empty; lockfile has no @workos-inc; encryption tests (round trip,
tamper, aad, rotate, shred) green; Google Calendar connect -> busy sources -> destination ->
event sync verified on staging; member add/remove updates Stripe seat quantity (test); QStash
workos-sync schedule removed; CI legacy-idp-guard step and boundary lint green.

Report: files deleted/changed, migrations, test results, CodeRabbit CLI counts, PR URL(s), and the
Vercel env var changes required.
```
