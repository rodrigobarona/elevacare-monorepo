# Eleva.care v3 Feature Flag Rollout Plan

Status: Authoritative

## Purpose

This document defines how Eleva v3 uses feature flags for safe rollout.

It should guide:

- progressive release strategy
- risky feature launch control
- environment-specific toggles
- cohort-based exposure
- cleanup discipline

## Provider Decision

- **API / adapter surface**: **Vercel Flags SDK**
- **Default backend provider**: **Vercel Edge Config**
- **Experimentation adapter (future)**: **PostHog Feature Flags** — reserved for A/B and experimentation flags once the product has traffic
- **Boundary**: all flag reads go through `packages/flags`. No direct `@vercel/flags` or PostHog flag SDK calls anywhere else in the codebase. CI verifies the boundary.

Dropped: WorkOS as flag provider (not validated for this role).

## Principles

- Feature flags are for rollout safety, not architecture.
- Flag high-risk or launch-sensitive features, not every tiny UI branch.
- Every flag has an owner and a cleanup target.
- Default values are defined in code and overridden by Edge Config — so if Edge Config is unreachable the app has a safe fallback.
- Kill-switches are preferred over rollbacks when a risky feature misbehaves.

## When To Use A Flag

Good uses:

- new booking / payment flows
- AI report generation
- mobile sharing flows
- organization / clinic capabilities
- experimental discovery ranking
- third-party adapter rollout (invoicing providers, SMS enablement)
- Stripe Dynamic Payment Method cohort exposure

Bad uses:

- permanent product complexity with no cleanup owner
- substitute for role-based access control (use RBAC)
- branch logic that should live in code review or config

## Recommended Rollout Stages

1. **Dev-only** — default off, overridden on for internal dev builds
2. **Internal staff** — Eleva team accounts
3. **Pilot cohort** — selected experts or clinics (usually 1–5)
4. **Staged rollout** — percentage-based or country-based cohort
5. **Default on** — flag removed from bypasses
6. **Cleanup** — flag and its code path removed by the cleanup target date

## Flag Naming Convention

`ff.<area>.<feature>` (snake_case, kebab-separated areas). Examples:

- `ff.mbway_enabled`
- `ff.three_party_revenue`
- `ff.invoicing.moloni`

Per-adapter flags use the `.` separator to make registries discoverable (`ff.invoicing.*`).

## Flag Metadata To Track

For each flag, record in `packages/flags/catalog.ts`:

- `name` (string)
- `purpose` (description)
- `owner` (team)
- `scope` (`global | user | org | cohort`)
- `default` (safe default in code)
- `rollout_stage`
- `kill_switch_behavior` (what the app does when the flag is force-off)
- `cleanup_target` (ISO date)
- `depends_on` (list of flags that must be on first)

## Seed Flags

| Flag | Purpose | Default | Scope | Owner |
|---|---|---|---|---|
| `ff.clinic_subscription_tiers` | Enable the clinic per-seat SaaS monetization path (default clinic monetization) | **on** | global | commercial |
| `ff.three_party_revenue` | Enable commission overlay on top of clinic SaaS (phase-2 opt-in) | off | org | commercial |
| `ff.sms_enabled` | Global SMS channel toggle (Twilio) | on (PT) / off (other markets) | cohort by country | platform |
| `ff.mbway_enabled` | MB WAY cohort toggle at checkout (safety valve over Dashboard-enabled method) | on (PT) | cohort by country | payments |
| `ff.ai_reports_beta` | Gate AI-assisted post-session report drafting | off | org | product |
| `ff.diary_share` | Gate patient→expert diary sharing | off | org | product |
| `ff.toconline_invoicing_enabled` | Tier 1 — Eleva→Expert/Clinic invoice automation via TOConline | staged rollout | global | payments |
| `ff.expert_invoicing_apps_enabled` | Tier 2 — Expert→Patient invoice registry globally enabled | off at launch, on by M8 | global | payments |
| `ff.invoicing.toconline` | Tier 2 TOConline expert-side adapter | off | per-expert install | payments |
| `ff.invoicing.moloni` | Tier 2 Moloni adapter | off | per-expert install | payments |
| `ff.invoicing.invoicexpress` | Tier 2 InvoiceXpress adapter | off (P2) | per-expert install | payments |
| `ff.invoicing.vendus` | Tier 2 Vendus adapter | off (P2) | per-expert install | payments |
| `ff.invoicing.primavera` | Tier 2 Primavera Cloud adapter | off (P3) | per-expert install | payments |

## Kill-Switch Behavior

Every flag declares what happens when forced off. Examples:

- `ff.ai_reports_beta=off` → hide AI draft UI, show "AI reports are temporarily unavailable" banner, continue to let experts write manual reports
- `ff.toconline_invoicing_enabled=off` → skip `issuePlatformFeeInvoice` workflow step (invoices backfilled on re-enable)
- `ff.invoicing.<provider>=off` → hide the provider from the expert install UI; existing connections continue reading; new installs blocked

## Dependencies

Edge Config updates:

- managed via Vercel CLI + a reviewed PR to `infra/flags/`
- every change is paired with a rollout plan + rollback plan
- production Edge Config requires 2-eyes approval

## Related Docs

- [`vendor-decision-matrix.md`](./vendor-decision-matrix.md)
- [`roadmap-and-milestones.md`](./roadmap-and-milestones.md)
- [`launch-readiness-checklist.md`](./launch-readiness-checklist.md)
- [`adrs/README.md`](./adrs/README.md) (ADR-008 Feature Flags)
