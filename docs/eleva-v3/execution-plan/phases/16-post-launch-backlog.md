# Phase 16 — Post-launch backlog (not a PR phase)

| Field      | Value                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Branch     | None. Each item below becomes its own `phase-16.N/<slug>` branch + PR when scheduled                 |
| Depends on | Phase 15 (production live, 7-day watch passed)                                                       |
| Effort     | Ongoing; each item sized individually                                                                |
| Exit gate  | Items are promoted into numbered phases (with their own phase file and prompt) as they are scheduled |

## Why this phase exists

Everything that was deliberately deferred to reach the Portugal launch lives here so it is not
lost and so that nobody re-opens it inside an earlier phase. When an item is picked up, copy the
structure of any earlier phase file (scope, deliverables, acceptance criteria, local references,
external docs, copy-paste prompt) into `phases/16-N-<slug>.md`, add it to the README phase index,
and run the standard loop from README section 4.

## Backlog (ordered by expected priority)

| #     | Item                                                                                                                                                            | Origin                                  | Notes                                                                                                                      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 16.1  | **Spain launch** (`es-ES` legal texts, Spanish IVA rules, health-sector disclaimers, Stripe payment methods for ES, pricing localisation)                       | `market-expansion-playbook.md`, ADR-012 | Requires accountant sign-off for ES IVA; Tier 1 invoices to ES experts (intra-EU reverse charge).                          |
| 16.2  | **Brazil (`pt-BR`) content + payments discovery**                                                                                                               | `market-expansion-playbook.md`          | Stripe BR is a separate platform account; do not assume Connect parity. Discovery only.                                    |
| 16.3  | **Academy content platform** (`apps/academy`, `@eleva/academy`: courses, lessons, enrolments, certificates, Stripe products for courses)                        | `academy-*` specs in handbook           | Reuse Tier 1/2 invoicing and payout engine; recorded lessons hosted on Vercel Blob private + signed URLs or Mux (new ADR). |
| 16.4  | **Marketplace search + discovery v2** (Typesense/Meilisearch or Neon `pg_search`, filters by specialty/language/price/availability, ranking)                    | Phase 4 kept simple SQL search          | New ADR for search engine choice; EU hosting required.                                                                     |
| 16.5  | **Notifications Lane 2** (marketing/lifecycle campaigns: onboarding drip, re-engagement, digest emails, consent-gated)                                          | `notifications-architecture.md`         | Resend Broadcasts or Customer.io EU; strict consent gating (PostHog cohorts).                                              |
| 16.6  | **Mobile apps** (Expo + Better Auth `expo` plugin, Daily React Native SDK)                                                                                      | Product roadmap                         | Better Auth `expo` plugin and Daily RN SDK both exist; needs API key/bearer flows from Phase 2.                            |
| 16.7  | **AI reports GA** (graduate `ff.ai_reports_beta`; structured templates per specialty; member-facing summaries; evaluation harness)                              | Phase 10 beta                           | Requires DPIA update and consent copy review; Vercel AI Gateway model pinning.                                             |
| 16.8  | **Session recording + transcription** (Daily cloud recording to EU storage, consent flow, retention)                                                            | Phase 9 left off by flag                | `ff.session_recording`; Daily recordings must land in EU bucket; retention per matrix.                                     |
| 16.9  | **Clinic advanced features** (rooms/locations, intake forms, shared calendars, clinic-level reporting, SSO for enterprise clinics via Better Auth `sso` plugin) | Phase 11 minimum viable                 | SSO plugin brings back part of what WorkOS offered, only for clinics that need it.                                         |
| 16.10 | **Expert marketplace growth tools** (referral codes, coupons via Stripe Coupons/Promotion Codes, gift sessions, packages/bundles)                               | Product roadmap                         | Packages interact with payout eligibility and Tier 2 invoicing (one invoice per package).                                  |
| 16.11 | **Member subscriptions / memberships** (recurring member plans, credits)                                                                                        | Product roadmap                         | Hybrid monetization v2; new ADR.                                                                                           |
| 16.12 | **Moloni + additional Tier 2 adapters** (InvoiceXpress, Vendus), SAF-T export                                                                                   | Phase 7 registry                        | Adapter interface already in `@eleva/accounting`; each adapter is a small PR.                                              |
| 16.13 | **Agentic surfaces** (MCP server exposing `apps/api` OpenAPI as tools with API-key auth; agent-friendly booking assistant)                                      | Agentic-first principle                 | Builds on `apiKey` + `openAPI` plugins from Phase 2; rate limits per key.                                                  |
| 16.14 | **Public status page + trust center** (SLOs, subprocessors, security posture)                                                                                   | Phase 13                                | BetterStack status page + `apps/docs` trust pages.                                                                         |
| 16.15 | **Tech-debt backlog burn-down**                                                                                                                                 | `tech-debt-backlog.md`                  | Review after each launch retro; items with owner + due phase.                                                              |
| 16.16 | **MVP decommission finalisation** (+30 days: archive Neon branch, delete migration schema, remove redirect map entries older than 12 months)                    | Phase 15                                | Requires checksum verification record from Phase 15.                                                                       |

## How to promote an item

1. Create `docs/eleva-v3/execution-plan/phases/16-N-<slug>.md` using the template in
   `phases/00-execution-plan-and-review-loop.md` (section "Phase file template").
2. Add the row to README section 5 with branch `phase-16.N/<slug>` and dependencies. The
   planning PR itself lands on `phase-16.N/<slug>-plan`; the build PR uses `phase-16.N/<slug>`.
3. If the item changes a locked decision, add a `decision-log.md` entry and a new ADR first.
4. Run `pnpm docs:execution-plan:html` and commit the regenerated `index.html` with the phase file.
5. Execute the standard loop (README section 4).

## Local references

- `docs/eleva-v3/{market-expansion-playbook,notifications-architecture,tech-debt-backlog,feature-flag-rollout-plan}.md`
- `docs/eleva-v3/execution-plan/phases/{04,07,09,10,11,13,15}-*.md` (origins of deferred items)

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo. Phase 16 is a backlog, not a
build phase. Your task is to PROMOTE one backlog item into a fully specified phase file.

1. Read AGENTS.md, docs/eleva-v3/execution-plan/README.md (sections 2, 4, 5, 6, 7) and
   docs/eleva-v3/execution-plan/phases/16-post-launch-backlog.md.
2. Pick item 16.<N> (given by the requester). Read its "Origin" documents and the earlier phase
   files it depends on.
3. Write docs/eleva-v3/execution-plan/phases/16-<N>-<slug>.md with the same structure as the
   other phase files: metadata table (branch phase-16.<N>/<slug>, depends on, effort, touches,
   exit gate), why it exists, scope (in/out), deliverables, acceptance criteria, tests, docs to
   update, local references, external docs (Context7 library IDs), risks, and a copy-paste prompt
   that starts with the universal preamble from README section 7.
4. If the item changes a locked decision (README section 2), write the decision-log.md entry
   and a new ADR under docs/eleva-v3/adrs/ first, and reference them from the phase file.
5. Add the row to README section 5; run pnpm docs:execution-plan:html; commit on branch
   phase-16.<N>/<slug>-plan as docs(plan): ... (the build PR that follows uses
   phase-16.<N>/<slug>); run pnpm review and pnpm review:branch; open the
   PR with the README section 8 template; loop on CodeRabbit until zero unresolved findings;
   request approval from @rodrigobarona; merge with squash.
```
