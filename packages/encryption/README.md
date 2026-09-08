# `@eleva/encryption`

Envelope encryption for org-scoped secrets and PHI fields (ADR-020).

KEKs live in env as `ELEVA_KEK_V<n>` (base64, 32 bytes). The highest `n` is
current. Never log key material. Never use `ENCRYPTION_KEY`.

Per-org DEKs live in `org_data_keys`, wrapped with the current KEK. Ciphertext
format: `v1:<kek_v>:<dek_v>:<iv_b64>:<tag_b64>:<data_b64>`.

```ts
import {
  encryptForOrg,
  decryptForOrg,
  encryptRecordFields,
  decryptRecordFields,
  rotateKek,
  shredOrgKeys,
} from "@eleva/encryption"

const ciphertext = await encryptForOrg(orgId, plaintext, aad)
const plaintext = await decryptForOrg(orgId, ciphertext, aad)
```

- `rotateKek(orgId)` re-wraps every DEK for that org with the current KEK.
  Existing ciphertext stays readable because decrypt loads the DEK by version.
- `shredOrgKeys(orgId)` deletes every DEK row. Later decrypt throws
  `EncryptionError("KEY_SHREDDED")`.
- Keep every `ELEVA_KEK_V<n>` that still wraps a DEK. Rotation runbook:
  `docs/eleva-v3/integration-runbooks.md`.
