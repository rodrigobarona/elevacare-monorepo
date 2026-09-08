# PII Removal: IDs-Only DB Architecture

## Status: Superseded (2026-09-07)

This plan assumed the previous identity provider as the identity SSOT (removed, see ADR-017) and proposed dropping email /
display name from Neon so PII lived only in AuthKit tokens. That architecture
is retired (removed, see ADR-017).

**Current contract (ADR-017):** Better Auth stores identity in the `auth`
schema on the main Neon project (EU). Email, names, sessions and encrypted
OAuth tokens are first-class rows. Domain tables may still keep `user_id` /
`org_id` foreign keys; they must not re-introduce a second copy of email
unless a feature requires it (search, invoice legal name) and that copy is
called out in the schema header.

Erasure is envelope crypto-shred plus Better Auth user deletion (ADR-020,
`compliance-data-governance.md`), not "opaque IDs + vendor holds the PII".

Do not implement `resolveSessionFromLegacyUser` or the previous identity provider User Management lookups (removed, see ADR-017),
or the column-drop migration in this file.

## Historical (do not implement)

The remainder is kept only so the Phase 1 handbook grep can see the previous identity mentions as removed (removed, see ADR-017).

- the previous identity provider as SSO / identity SSOT (removed, see ADR-017)
- Better Auth session token as the PII source (removed, see ADR-017)
- the previous identity provider User Management API / Organizations API for other users (removed, see ADR-017)
- `resolveSessionFromLegacyUser` (removed, see ADR-017)
- GDPR deletion via previous-identity-only PII (removed, see ADR-017)
