# ADR-019: MVP data migration and DNS cutover

## Status

Accepted

## Date

2026-09-07

## Context

Eleva.care v3 is a rebuild, not a greenfield relaunch. The live MVP (`eleva.care` today) has
members, experts, organizations, bookings, a Stripe Connect platform, payout history and
clinical records that must keep working after DNS switches. A wipe-and-restart would lose
Connect accounts, fiscal history and member relationships.

Constraints: WorkOS passwords cannot be exported; Google social identities must not be
re-linked by e-mail match (account-takeover risk); Stripe Connect accounts and customers live
on the existing platform account and must not be recreated; PHI in WorkOS Vault must be
decrypted before WorkOS is cancelled and re-encrypted with `@eleva/encryption` (ADR-020);
public URLs (`/[username]`, `/[username]/[eventSlug]`, `/pt-BR/*`) must keep resolving;
money movement after cutover makes a full rollback unsafe.

## Decision

1. **Same Stripe platform.** v3 uses the existing Stripe account. Connect Express accounts,
   customers, payment methods and subscriptions are referenced by their Stripe ids, not
   recreated. Commission mapping for grandfathered plans is a finance-reviewed table in
   Phase 14.
2. **Idempotent import.** Scripts live in `infra/migration`. Every run is dry-run first
   (`--apply` to mutate). Rows are keyed in `migration_id_map` by
   `(source_table, source_id, target_table, target_kind)` so one-to-many fan-out is
   addressable. Checksums are HMAC-SHA256 with `MIGRATION_CHECKSUM_KEY`.
   `migration_runs.source_watermark` is the MVP snapshot (`pg_export_snapshot()` +
   `pg_current_wal_lsn()` informational); deltas never key on target completion time.
3. **Identity.** Users are created in Better Auth without a password. Welcome is magic-link
   / set-password. Google accounts are linked **only** from the WorkOS identity subject
   (`idp_id`) exported while WorkOS is still live. Users without a stored subject sign in
   with the magic link and then link Google through Better Auth `accountLinking`
   (`trustedProviders: ["google"]`, verified e-mail required). Never link by e-mail match.
4. **Secrets and PHI.** WorkOS Vault records are exported and checksummed in Phase 14
   **before** any WorkOS account closure, then re-encrypted with `encryptForOrg`. Vault
   remnants are not left as the system of record.
5. **URLs.** `public_handles` (Phase 4 PR 04.1) is the shared username/slug namespace.
   Phase 14 asserts every MVP public URL resolves. `/pt-BR/*` 301s to `/pt/*` (D-01).
6. **Cutover.** Phase 15 is DNS + env, one gated mutation at a time (`pnpm cutover:gate`).
   Rollback is allowed only before `CUTOVER_ACCEPTANCE_TS = min(CUTOVER_TS + 48 h, first
executed payout)` and covers identity + bookings, not money. After the acceptance
   point, issues are fixed forward.
7. **Historical invoices.** Pre-cutover Tier 1 documents are imported as
   `legacy` / `legacy_missing` and never reissued (D-09).

## Alternatives Considered

### Greenfield relaunch (no import)

- Pros: no migration risk; clean schema.
- Cons: loses Connect accounts, bookings, member relationships, fiscal history; every expert
  re-onboards. Rejected by the founder.

### Dual-write from MVP during a long overlap

- Pros: smaller cutover window.
- Cons: two write paths, two Stripe webhook consumers, weeks of reconciliation. Rejected
  in favour of rehearsed snapshot import + short freeze.

## Consequences

- Positive: members and experts keep their history; Stripe objects stay valid; public URLs
  survive.
- Tradeoff: Phase 14 is a real migration platform (rehearse from production snapshots,
  checksums, id map) and Phase 15 is operator-gated. After first payout there is no
  rollback.
- Operational: `MIGRATION_CHECKSUM_KEY`, `MIGRATION_CONFIRM_PRODUCTION=<today>` for
  production applies; WorkOS stays live until Vault export + identity subject export are
  verified.

## Related

- [`execution-plan/phases/14-mvp-migration.md`](../execution-plan/phases/14-mvp-migration.md),
  [`15-launch-cutover.md`](../execution-plan/phases/15-launch-cutover.md)
- [ADR-017](ADR-017-better-auth-identity.md), [ADR-020](ADR-020-envelope-encryption.md)
