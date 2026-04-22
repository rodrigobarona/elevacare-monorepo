# ADR-008: Feature Flags — Vercel Flags SDK + Edge Config

## Status

Accepted

## Date

2026-04-22

## Context

Eleva needs a feature flag system for safe rollout of risky features (AI report generation, diary sharing, clinic SaaS, new payment methods, three-party revenue) and for cohort-based staged exposure.

The original prompt suggested WorkOS feature flags. WorkOS's flag product is not validated for Eleva's scale/use cases at the time of planning. PostHog has mature feature flags, but coupling flag reads to PostHog SDK creates bundle size + initialization concerns in hot paths like middleware.

Vercel Flags SDK is a provider-agnostic adapter (a thin facade), and Vercel Edge Config is a purpose-built, low-latency KV store designed for exactly this use case.

## Decision

- **Vercel Flags SDK** is the API/adapter surface used by app code.
- **Vercel Edge Config** is the default backend provider for platform flags (kill-switches, phased rollouts, cohort toggles, tenant-scoped toggles).
- **PostHog adapter** is reserved for future experimentation flags when the product has traffic.
- **All flag reads go through `packages/flags`** — no direct `@vercel/flags` or PostHog flag SDK imports elsewhere. CI verifies.

## Alternatives Considered

### Option A — WorkOS feature flags

- Pros: one vendor for auth + flags
- Cons: unvalidated for this role; couples two different concerns; fallback story unclear

### Option B — PostHog feature flags as primary

- Pros: already in stack for product analytics; supports experimentation natively
- Cons: SDK initialization in middleware/edge is heavier; couples operational kill-switches to an analytics vendor; harder to get low-latency reads in all runtimes

### Option C — LaunchDarkly / Statsig

- Pros: mature, experimentation-first
- Cons: new vendor, new DPA, cost scales fast, overkill for launch

### Option D — Vercel Flags SDK + Edge Config (chosen)

- Pros: first-party on Vercel, low-latency, no new subprocessor, adapter pattern keeps PostHog/LD/Statsig as future swap candidates
- Cons: newer product, less battle-tested than LaunchDarkly at enormous scale (but adequate for Eleva's scale)

## Consequences

- `packages/flags` exposes typed flag functions (one per flag in the catalog)
- Edge Config updated via Vercel CLI + reviewed PR to `infra/flags/`
- Flag naming convention: `ff.<area>.<feature>`
- Kill-switch behavior declared per flag (what the app does when forced off)
- Seed flags on day one: `ff.clinic_subscription_tiers` (on), `ff.three_party_revenue` (off), `ff.sms_enabled`, `ff.mbway_enabled`, `ff.ai_reports_beta`, `ff.diary_share`, `ff.toconline_invoicing_enabled`, `ff.expert_invoicing_apps_enabled`, `ff.invoicing.{provider}`
- Production Edge Config updates require 2-eyes approval
