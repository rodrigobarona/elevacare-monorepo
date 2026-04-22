# Encryption Architecture

> **Status**: Production Ready
> **Last Updated**: December 16, 2025
> **Solution**: WorkOS Vault (Exclusive)

## Overview

The eleva-care application uses WorkOS Vault as the exclusive encryption solution for healthcare compliance (HIPAA/GDPR). All sensitive data is encrypted with org-scoped keys using envelope encryption. HMAC operations use Bun.CryptoHasher for native performance.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Encryption Architecture                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    WORKOS VAULT (Exclusive)                        │ │
│  │                                                                     │ │
│  │  Purpose: All sensitive data encryption with compliance            │ │
│  │                                                                     │ │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐ │ │
│  │  │ Medical Records │    │  OAuth Tokens   │    │ Future PHI/PII │ │ │
│  │  │   (AES-256)     │    │ (Google Calendar)│    │                │ │ │
│  │  └────────┬────────┘    └────────┬────────┘    └───────┬────────┘ │ │
│  │           │                      │                      │          │ │
│  │           └──────────────────────┼──────────────────────┘          │ │
│  │                                  ▼                                  │ │
│  │                    ┌──────────────────────────┐                    │ │
│  │                    │   Envelope Encryption    │                    │ │
│  │                    │   DEK + KEK Pattern      │                    │ │
│  │                    │   Org-Scoped Keys        │                    │ │
│  │                    └──────────────────────────┘                    │ │
│  │                                                                     │ │
│  │  Features:                                                          │ │
│  │  • Unique key per organization (blast radius: 1 org)               │ │
│  │  • Automatic key rotation (zero downtime)                          │ │
│  │  • Built-in audit logging (SOC 2 certified)                        │ │
│  │  • BYOK support for enterprise customers                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                 BUN.CRYPTOHASHER (HMAC Operations)                 │ │
│  │                                                                     │ │
│  │  Purpose: Signature verification and authentication                │ │
│  │                                                                     │ │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐ │ │
│  │  │ QStash Verify   │    │ QStash Tokens   │    │ Novu Auth Hash │ │ │
│  │  │ (HMAC-SHA256)   │    │ (HMAC-SHA256)   │    │ (HMAC-SHA256)  │ │ │
│  │  └─────────────────┘    └─────────────────┘    └────────────────┘ │ │
│  │                                                                     │ │
│  │  Benefits:                                                          │ │
│  │  • Native Bun performance (no Node.js overhead)                    │ │
│  │  • Same API as node:crypto for easy migration                      │ │
│  │  • Full TypeScript support via @types/bun                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## WorkOS Vault (Exclusive Encryption)

### What It Encrypts

| Data Type            | Location                               | Encryption Context              |
| -------------------- | -------------------------------------- | ------------------------------- |
| Medical Records      | `RecordsTable.vaultEncryptedContent`   | `dataType: 'medical_record'`    |
| Google Access Token  | `UsersTable.vaultGoogleAccessToken`    | `dataType: 'google_access_token'` |
| Google Refresh Token | `UsersTable.vaultGoogleRefreshToken`   | `dataType: 'google_refresh_token'` |

### Implementation

```typescript
// src/lib/integrations/workos/vault.ts

import { WorkOS } from '@workos-inc/node';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Encrypt data using WorkOS Vault with envelope encryption
 */
export async function encryptForOrg(
  orgId: string,
  plaintext: string,
  context: EncryptionContext,
): Promise<string> {
  // 1. Generate DEK (Data Encryption Key) via WorkOS
  const dataKey = await workos.vault.createDataKey({
    organizationId: orgId,
  });
  
  // 2. Encrypt locally with DEK
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, dataKey.plaintextKey, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  
  // 3. Return encrypted data + encrypted DEK
  return JSON.stringify({
    ciphertext,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    encryptedKey: dataKey.encryptedKeys,
    metadata: { algorithm: ALGORITHM, context }
  });
}
```

### Why WorkOS Vault?

| Feature        | WorkOS Vault        | DIY AES-256-GCM     |
| -------------- | ------------------- | ------------------- |
| Key Isolation  | Per-organization    | Single key          |
| Blast Radius   | 1 organization      | Entire database     |
| Key Rotation   | Automatic           | Manual, risky       |
| Audit Trail    | Built-in, certified | DIY implementation  |
| BYOK           | Enterprise option   | Not available       |
| Compliance     | SOC 2 Type II       | Self-certified      |

### Configuration

```bash
# .env
WORKOS_API_KEY=sk_live_...           # Required for Vault
```

## Bun.CryptoHasher (HMAC)

### What It Handles

| Operation              | File                                         | Purpose                    |
| ---------------------- | -------------------------------------------- | -------------------------- |
| Signature Verification | `src/lib/integrations/qstash/utils.ts`       | Verify QStash requests     |
| Token Generation       | `src/app/api/qstash/route.ts`                | Internal verification      |
| Subscriber Hash        | `src/app/api/novu/subscriber-hash/route.ts`  | Novu authentication        |

### Implementation

```typescript
// QStash signature verification
import { timingSafeEqual } from 'node:crypto';

// Generate HMAC using Bun.CryptoHasher
const hasher = new Bun.CryptoHasher('sha256', currentKey);
hasher.update(timestamp);
const expectedSignature = hasher.digest('hex');

// Timing-safe comparison (prevents timing attacks)
const isValid = timingSafeEqual(
  Buffer.from(signature, 'hex'),
  Buffer.from(expectedSignature, 'hex'),
);
```

### Why Bun.CryptoHasher?

1. **Native Performance**: No Node.js compatibility layer overhead
2. **Same API**: Easy migration from `crypto.createHmac()`
3. **Type Safety**: Full TypeScript support via `@types/bun`
4. **Bun-Optimized**: Takes advantage of Bun's Zig-based implementation

## Healthcheck Runtime Detection

The healthcheck endpoint reports which runtime is active:

```typescript
// src/app/api/healthcheck/route.ts

const isBunRuntime = typeof Bun !== 'undefined';
const runtime = isBunRuntime ? 'bun' : 'node';
const runtimeVersion = isBunRuntime ? Bun.version : process.version;

// Response includes:
{
  "status": "healthy",
  "runtime": "bun",
  "runtimeVersion": "1.3.4",
  "isBun": true,
  // ... other health data
}
```

## Security Best Practices

### DO ✅

- Use WorkOS Vault for all sensitive data (PHI, PII, tokens)
- Use `Bun.CryptoHasher` for HMAC operations
- Always use timing-safe comparison for signatures
- Enable audit logging in production
- Use org-scoped keys for data isolation

### DON'T ❌

- Use simple string comparison for signatures (use `timingSafeEqual`)
- Share encryption keys across organizations
- Log plaintext sensitive data
- Store unencrypted PHI/PII data

## Type Safety

Install official Bun types:

```bash
bun add -d @types/bun
```

This provides full TypeScript support for:

- `Bun.CryptoHasher`
- `Bun.version`
- `Bun.password` (future use)
- All Bun-specific APIs

## Files Reference

| File                                         | Purpose                    |
| -------------------------------------------- | -------------------------- |
| `src/lib/integrations/workos/vault.ts`       | WorkOS Vault client        |
| `src/lib/integrations/workos/vault-utils.ts` | Vault validation utilities |
| `src/lib/integrations/qstash/utils.ts`       | QStash HMAC verification   |
| `src/app/api/qstash/route.ts`                | QStash token generation    |
| `src/app/api/novu/subscriber-hash/route.ts`  | Novu subscriber hash       |
| `src/app/api/healthcheck/route.ts`           | Runtime detection          |

## Related Documentation

- [WorkOS Vault Implementation](./_WorkOS%20Vault%20implemenation/README.md)
- [Bun Runtime Migration](./BUN-RUNTIME-MIGRATION.md)
- [Security Guidelines](../04-development/standards/security-guidelines.md)
