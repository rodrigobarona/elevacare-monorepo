# ADR-020: Envelope encryption without a vault product

## Status

Accepted

## Date

2026-09-07

## Context

The handbook stored OAuth tokens and PHI references in WorkOS Vault via `@eleva/encryption`.
Vault is a second data plane (US/EU residency, a second DPA, a second outage mode) and it
disappears when WorkOS is cancelled (ADR-017). Eleva already needs application-level
encryption for clinical notes, reports and documents (Phase 10) that a hosted vault would
not wrap per-org for crypto-shred. Better Auth encrypts its own OAuth tokens
when `account: { encryptOAuthTokens: true }` is set (required; Phase 2 fails
CI if the flag is missing or false) so calendar tokens do not need this package.

Constraints: no HashiCorp Vault / AWS KMS / Cloud KMS in the launch stack (one more vendor);
KEK lives in env, versioned; crypto-shred = delete the DEK, not "overwrite ciphertext"; KEK
and DEK and plaintext never logged (Sentry redaction in Phase 10).

## Decision

1. **`@eleva/encryption` is the only crypto package.** AES-256-GCM envelope: a per-org DEK
   encrypts payloads; a versioned KEK from env wraps the DEK. API:
   `encryptForOrg` / `decryptForOrg` / `rotateKek` / `shredOrgKeys`.
2. **`org_data_keys`.** Columns: `org_id`, `key_version`, `wrapped_dek`, `kek_version`,
   `created_at`, `retired_at`. Active key = `retired_at IS NULL`. `key_version` is the
   only DEK version name (ciphertext and table). `getOrCreateOrgDek` is concurrency-safe
   (row lock + `ON CONFLICT DO NOTHING`).
3. **KEK.** Every active wrap version is `ELEVA_KEK_V<n>` (base64 32 bytes). The inventory
   is the set of env vars matching `ELEVA_KEK_V[0-9]+`, not `ELEVA_KEK_V1` alone. Rotation
   re-wraps the active DEK in place (`kek_version` updated, `retired_at` stays NULL).
   Any history row with `retired_at` set is deleted by the same job after the new wrap
   decrypts. Old KEKs stay in env until
   `SELECT count(*) FROM org_data_keys WHERE kek_version = <old>` is 0 (no active or
   leftover history row), then the env var is deleted. Custody and rotation runbook
   lands in Phase 10; evidence in the Phase 13 compliance pack.
4. **Ciphertext format.** `v1:<key_version>:<iv>:<tag>:<data>` (base64 segments).
   `decryptForOrg` loads `org_data_keys` by `(org_id, key_version)` and unwraps the DEK
   with `ELEVA_KEK_V{row.kek_version}`. The ciphertext does **not** select the KEK —
   after `rotateKek` the row's `kek_version` is the new wrap, so existing ciphertext
   stays readable and the old `ELEVA_KEK_V<n>` can be deleted once no row references it.
   Parsers fail closed on an unknown version prefix.
5. **Crypto-shred.** `shredOrgKeys` **deletes** `org_data_keys` rows for that org (not
   UPDATE-to-null). Ciphertext remains but is unreadable. Legal-hold / retention (D-12)
   can block shred until the retention window ends.
6. **What this package does not encrypt.** Better Auth `account` OAuth tokens (Better Auth
   owns that). TOConline / Moloni refresh tokens are encrypted here once Vault is gone
   (Phase 3/7). Session recordings are out of scope until 16.8.
7. **Boundary.** Only `packages/encryption` may call `crypto.createCipheriv` /
   `createDecipheriv` for application payloads. CI / boundary lint enforces this. Tests use
   known vectors, never production KEKs.

## Alternatives Considered

### Keep WorkOS Vault

- Pros: already integrated; hosted HSM story.
- Cons: cancelled with WorkOS; second data plane; per-org shred is a Vault object delete
  we do not control as cleanly as a DEK row.

### Cloud KMS (AWS KMS / GCP / Neon)

- Pros: HSM-backed KEK.
- Cons: another vendor and another region decision at launch. Revisit after Phase 13 if
  the DPO requires it; the envelope API stays the same (`kek_version` already exists).

### Application-level AES with a single env key

- Pros: simpler.
- Cons: no per-org shred; rotation rewrites every row; one leak decrypts every tenant.

## Consequences

- Positive: one encryption story for PHI and leftover integration secrets; shred is a
  DELETE; Better Auth owns OAuth tokens.
- Tradeoff: Eleva holds the KEK in env (Vercel encrypted env + operator runbook). Phase 10
  writes the custody checklist; Phase 13 files the evidence.
- Supersedes: WorkOS Vault usage in `compliance-data-governance.md` and the original
  `@eleva/encryption` Vault wrapper. ADR-009 transcript encryption reads as this ADR.

## Related

- [`execution-plan/phases/03-remove-workos.md`](../execution-plan/phases/03-remove-workos.md),
  [`10-records-crm-ai.md`](../execution-plan/phases/10-records-crm-ai.md)
- [ADR-017](ADR-017-better-auth-identity.md), [ADR-009](ADR-009-ai-and-transcripts.md)
