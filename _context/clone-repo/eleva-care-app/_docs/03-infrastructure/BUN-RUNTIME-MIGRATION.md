# Bun Runtime Migration

> **Status**: Implemented (Hybrid Approach)
> **Date**: December 2025
> **Version**: Bun 1.3.4 (local) / Node.js 24.x (Vercel)

## Overview

The eleva-care-app uses a **hybrid runtime approach** that combines the best of both worlds:

- **🐰 Bun** for local development (fast installs, excellent DX, native TypeScript)
- **🟢 Node.js 24.x** for Vercel production (stability, full npm compatibility)

This approach was chosen because:

1. **Production Stability**: Bun on Vercel is still in Beta status
2. **Full npm Compatibility**: Some npm features (like nested overrides) are not supported by Bun
3. **Healthcare Requirements**: For a healthcare platform, production stability is paramount
4. **Best Developer Experience**: Bun's speed benefits are most impactful during development

## Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Runtime Architecture                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Local Development (Bun 1.3.4)                          │    │
│  │  • bun dev / bun dev:full / bun dev:only               │    │
│  │  • bun install (4x faster than npm/pnpm)               │    │
│  │  • Native TypeScript execution                          │    │
│  │  • Bun.CryptoHasher for HMAC operations                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Vercel Production (Node.js 24.x)                       │    │
│  │  • next build / next start                              │    │
│  │  • Full npm overrides support                           │    │
│  │  • Stable, battle-tested runtime                        │    │
│  │  • node:crypto fallback for crypto operations           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  GitHub Actions CI (Bun + Node.js)                      │    │
│  │  • bun install for fast dependency installation         │    │
│  │  • Tests run in Node.js environment                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## What Changed

### Runtime Configuration

| Component         | Before (Full Bun)      | After (Hybrid)                    |
| ----------------- | ---------------------- | --------------------------------- |
| Local Runtime     | Bun 1.3.4              | Bun 1.3.4                         |
| Vercel Runtime    | Bun 1.x (Beta)         | Node.js 24.x (Stable)             |
| Package Manager   | Bun                    | Bun                               |
| Build Script      | `bun --bun next build` | `next build`                      |
| Start Script      | `bun --bun next start` | `next start`                      |
| Dev Script        | `bun --bun next dev`   | `bun --bun next dev` (unchanged)  |

### Files Modified

| File                         | Changes                                           |
| ---------------------------- | ------------------------------------------------- |
| `vercel.json`                | Removed `bunVersion: "1.x"` (uses Node.js now)    |
| `package.json`               | Updated `engines` to `"node": "24.x"`             |
| `package.json`               | Changed `build` to `next build` (Node.js)         |
| `package.json`               | Changed `start` to `next start` (Node.js)         |
| `package.json`               | Added `build:bun` for local Bun builds            |
| `package.json`               | Removed nested `botid` override (Bun limitation)  |
| `.github/workflows/test.yml` | Uses `oven-sh/setup-bun@v2` for installs          |

## Performance Improvements

| Metric                       | Node.js/pnpm | Bun (Local) | Improvement    |
| ---------------------------- | ------------ | ----------- | -------------- |
| Package install              | ~15s         | ~4s         | **4x faster**  |
| Dev server cold start        | ~15s         | ~5s         | **3x faster**  |
| First page compile           | ~11s         | ~9s         | **22% faster** |
| Proxy.ts execution           | ~315ms       | ~45ms       | **7x faster**  |
| Script execution (tsx → bun) | ~500ms       | ~100ms      | **5x faster**  |

## Configuration

### Vercel Deployment (Node.js 24.x)

```json
// vercel.json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/keep-alive",
      "schedule": "0 6 * * *"
    }
  ]
}
```

**Note:** No `bunVersion` is specified, so Vercel uses Node.js based on the `engines` field in `package.json`.

### Package.json Configuration

```json
{
  "engines": {
    "node": "24.x"
  },
  "scripts": {
    // Development (Bun runtime for speed)
    "dev": "concurrently ... \"bun run dev:next\" ...",
    "dev:next": "bun --bun next dev --port 3000",
    "dev:only": "bun --bun next dev --port 3000",

    // Production (Node.js for stability)
    "build": "next build",
    "start": "next start",

    // Optional: Local Bun build
    "build:bun": "bun --bun next build",

    // Scripts still use Bun for speed
    "postbuild": "bun scripts/utilities/update-qstash-schedules.ts",
    "qstash:dev": "bunx @upstash/qstash-cli@latest dev"
  },
  "overrides": {
    "punycode": "^2.3.1",
    "@types/react": "19.0.10",
    "@types/react-dom": "19.0.4",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "prismjs": "^1.30.0",
    "prettier": "3.6.2"
    // Note: No nested overrides (not supported by Bun)
  }
}
```

### Why We Removed `bunVersion` from Vercel

1. **Beta Status**: Bun runtime on Vercel is still in Beta
2. **Nested Overrides**: Bun doesn't support npm's nested override syntax:
   ```json
   // ❌ Not supported by Bun
   "botid": {
     "next": "$next"
   }
   ```
3. **Middleware Limitation**: Bun on Vercel requires middleware to explicitly set `runtime: "nodejs"`
4. **Healthcare Stability**: Production stability is critical for healthcare applications

### Optional: bunfig.toml

For advanced local configuration, create a `bunfig.toml` in the project root:

```toml
# bunfig.toml (optional)

[install]
# Lockfile settings
frozenLockfile = false

[test]
# Test runner configuration (future migration)

[env]
# Environment variables for tests
NODE_ENV = "test"
```

## Development Commands

### Daily Development (Uses Bun)

```bash
# Start development server (Next.js + video sync)
bun dev

# Start full development (includes QStash)
bun dev:full

# Start only Next.js
bun dev:only

# Run tests
bun test

# Run linting
bun run lint

# Type checking
bun run type-check

# Database operations
bun run db:generate
bun run db:migrate
bun run db:studio
```

### Build Commands

```bash
# Production build (uses Node.js - same as Vercel)
bun run build

# Local Bun build (for testing)
bun run build:bun

# Analyze bundle
bun run build:analyze
```

### Package Management (Uses Bun)

```bash
# Install dependencies (generates bun.lock)
bun install

# Add a dependency
bun add <package>

# Add a dev dependency
bun add -d <package>

# Remove a dependency
bun remove <package>

# Update dependencies
bun update

# View outdated packages
bun outdated
```

### Script Execution

```bash
# Run TypeScript files directly (no tsx needed)
bun scripts/utilities/update-qstash-schedules.ts

# Run package binaries
bunx drizzle-kit studio

# Run with specific flags (local dev only)
bun --bun next build
```

## What Was NOT Changed

These dependencies are specifically optimized for serverless/edge environments and were intentionally kept:

| Dependency                 | Reason                                           |
| -------------------------- | ------------------------------------------------ |
| `@neondatabase/serverless` | HTTP-based driver optimized for Vercel Functions |
| `@upstash/redis`           | REST API for serverless (Bun's Redis uses TCP)   |
| `@vercel/blob`             | Proprietary Vercel storage                       |
| `drizzle-orm`              | ORM layer (works with any driver)                |
| `googleapis`               | Complex SDK with no Bun equivalent               |

## CI/CD Configuration

### GitHub Actions

The workflow uses `oven-sh/setup-bun@v2` for fast dependency installation:

```yaml
- name: 📦 Setup Bun
  uses: oven-sh/setup-bun@v2
  with:
    bun-version: latest

- name: 📦 Install dependencies
  run: bun install --frozen-lockfile

# Tests run in the default Node.js environment
- name: 🧪 Run tests
  run: bun test
```

### Vercel

Vercel detects `"node": "24.x"` in `package.json` and uses Node.js 24.x automatically. No additional configuration needed.

**Build Process on Vercel:**
1. Vercel detects Bun lockfile (`bun.lock`) and uses Bun for installation
2. Build runs with Node.js 24.x (no `bunVersion` in vercel.json)
3. Serverless functions run on Node.js runtime

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Bun Not Found

```bash
# Add Bun to PATH
source ~/.zshrc

# Or use full path
~/.bun/bin/bun install
```

### QStash CLI Issues

The QStash CLI may have compatibility issues. Run it separately:

```bash
bunx @upstash/qstash-cli@latest dev
```

Or use the `dev` command without QStash:

```bash
bun dev  # Runs Next.js + video sync only
```

### Build Differences Between Local and Production

If you notice differences between local builds and Vercel builds:

```bash
# Test with Node.js build locally (mirrors Vercel)
bun run build

# Test with Bun build locally
bun run build:bun
```

## Encryption & Crypto Architecture

### Overview

The application uses a layered encryption architecture optimized for both security and performance:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Encryption Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  WorkOS Vault (Primary) - Sensitive Data                │    │
│  │  • Medical records                                       │    │
│  │  • OAuth tokens (Google Calendar)                        │    │
│  │  • Org-scoped keys (unique per organization)             │    │
│  │  • Automatic key rotation                                │    │
│  │  • SOC 2 Type II certified                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Crypto Operations (Runtime-Aware)                      │    │
│  │  • Local: Bun.CryptoHasher (native performance)         │    │
│  │  • Vercel: node:crypto (full compatibility)             │    │
│  │  • QStash request verification                          │    │
│  │  • Novu subscriber authentication                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### WorkOS Vault (Primary Encryption)

For all sensitive data, we use WorkOS Vault with envelope encryption:

```typescript
// src/lib/integrations/workos/vault.ts
import { WorkOS } from '@workos-inc/node';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Encrypt medical records with org-scoped keys
const encrypted = await encryptForOrg(orgId, plaintext, {
  userId: workosUserId,
  dataType: 'medical_record',
  recordId: recordId,
});

// Decrypt
const decrypted = await decryptForOrg(orgId, encrypted, context);
```

**Key Features:**

- **Org-scoped keys**: Each organization has unique encryption keys
- **Envelope encryption**: DEK (Data Encryption Key) + KEK (Key Encryption Key)
- **Automatic rotation**: WorkOS manages key rotation transparently
- **Audit logging**: All operations logged for compliance
- **HIPAA/GDPR ready**: SOC 2 Type II certified infrastructure

### Runtime-Aware Crypto Operations

The codebase includes crypto utilities that work in both Bun and Node.js:

```typescript
// Runtime detection
const isBunRuntime = typeof Bun !== 'undefined';

if (isBunRuntime) {
  // Use Bun.CryptoHasher for better performance
  const hasher = new Bun.CryptoHasher('sha256', key);
  hasher.update(data);
  return hasher.digest('hex');
} else {
  // Fall back to node:crypto
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', key).update(data).digest('hex');
}
```

**Files Using Crypto Operations:**

| File                                        | Usage                     |
| ------------------------------------------- | ------------------------- |
| `src/lib/integrations/qstash/utils.ts`      | Signature verification    |
| `src/app/api/qstash/route.ts`               | Token generation          |
| `src/app/api/novu/subscriber-hash/route.ts` | Subscriber authentication |

### Type Safety

Official Bun types are provided by `@types/bun`:

```bash
bun add -d @types/bun
```

This provides full TypeScript support for:

- `Bun.CryptoHasher`
- `Bun.version`
- `Bun.password` (if needed in future)
- All Bun-specific APIs

### Healthcheck Runtime Detection

The healthcheck endpoint reports runtime information:

```typescript
// src/app/api/healthcheck/route.ts
const isBunRuntime = typeof Bun !== 'undefined';
const runtime = isBunRuntime ? 'bun' : 'node';
const runtimeVersion = isBunRuntime ? Bun.version : process.version;

// Response includes:
{
  "runtime": "node",  // On Vercel
  "runtimeVersion": "24.0.0",
  "isBun": false,
  // ... other health data
}
```

**Benefits:**

- **Production Monitoring**: Better Stack, PostHog track runtime info
- **Debugging**: Easy identification of runtime environment
- **Verification**: Confirm hybrid approach is working correctly

## Future Improvements (Phase 4+)

### Testing Migration (Optional)

Migrate from Vitest to Bun's built-in test runner:

```typescript
// Before (Vitest) - CURRENT
import { describe, it, expect, vi } from 'vitest';

// After (Bun) - OPTIONAL
import { describe, it, expect, mock } from 'bun:test';
```

Expected improvement: 14-23x faster test execution.

**Note:** We chose to keep Vitest for now due to its mature ecosystem and Jest compatibility.

### Full Bun on Vercel (When Stable)

When Bun on Vercel exits Beta and supports all npm features:

```json
// vercel.json (future)
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "bunVersion": "1.x"
}
```

```json
// package.json (future)
{
  "scripts": {
    "build": "bun --bun next build",
    "start": "bun --bun next start"
  }
}
```

### Password Hashing (Not Needed)

Bun provides built-in password hashing:

```typescript
// Bun built-in (Argon2id by default)
const hash = await Bun.password.hash(password);
const isValid = await Bun.password.verify(password, hash);
```

**Note:** We don't use this because WorkOS handles all password hashing externally through AuthKit.

## Resources

- [Bun Documentation](https://bun.sh/docs)
- [Bun on Vercel](https://vercel.com/docs/functions/runtimes/bun)
- [Vercel Node.js Versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Bun GitHub](https://github.com/oven-sh/bun)
- [Migration Guide: npm to Bun](https://bun.sh/docs/guides/install/from-npm-install-to-bun-install)
- [Bun Overrides Documentation](https://bun.sh/docs/pm/overrides)
