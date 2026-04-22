# ADR-002: Package Manager — pnpm installer + bun as task runner

## Status

Accepted

## Date

2026-04-22

## Context

The current repo ships a shadcn monorepo template using Bun (`bun.lock`, `"packageManager": "bun@1.3.5"`). We need a single, authoritative package manager for v3 that:

- gives identical dependency resolution between local dev and Vercel CI
- supports workspace-protocol linking across apps/packages
- integrates cleanly with Turborepo remote cache
- aligns with the wider ecosystem (next-forge, cal.com, shadcn, most Vercel docs)
- keeps local install/test fast enough to not frustrate developers

Bun is faster for `install` locally but creates risk: if `bun install` resolves one set of transitive versions while Vercel resolves another with pnpm, we get "works on my machine" bugs in payment and auth paths where we cannot afford them.

## Decision

- **pnpm** is the single installer and lockfile source of truth. Turborepo on top.
- Pin `"packageManager": "pnpm@<version>"` in the root `package.json`.
- **Bun is allowed only as a task/script runner** (`bun run`, `bun test` for packages that don't need Vitest features).
- **`bun install` is banned.** CI asserts no `bun.lock` exists at repo root.

## Alternatives Considered

### Option A — Hybrid (bun install locally + pnpm on Vercel)

- Pros: fastest cold install locally
- Cons: two resolvers → lockfile drift → divergent production builds. Also splits workspace-protocol, patches, and `overrides` semantics.

### Option B — All bun (install + runtime)

- Pros: single tool, fast
- Cons: Vercel support is newer, less battle-tested for marketplace + payments surface; Expo/React Native edges; most platform docs assume pnpm

### Option C — All pnpm (chosen)

- Pros: one lockfile, identical dev/CI resolution, ecosystem alignment, Turborepo + Vercel remote cache first-class
- Cons: ~10–20s slower cold install than bun

## Consequences

- Phase 1 first task: migrate `bun.lock` → `pnpm-lock.yaml`, rename `@workspace/*` packages → `@eleva/*`, preserve shadcn `components.json`
- Users invoking `bun install` will hit a repo guard that fails early
- Future `packageManager` version bumps reviewed via PR
- Bun remains useful for `bun run` / `bun test` as a dev speed booster
