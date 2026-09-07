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
2. Add the row to README section 5 with branch `phase-16.N/<slug>` and dependencies.
3. If the item changes a locked decision, add a `decision-log.md` entry and a new ADR first.
4. Run `pnpm docs:execution-plan:html` and commit the regenerated `index.html` with the phase file.
5. One branch, one PR (README section 4 rule 1): the phase file, README row, decision-log/ADR
   changes and the regenerated `index.html` are the **first commit** (`docs(p16.N): ...`) on
   `phase-16.N/<slug>`; the implementation commits follow on the same branch and the single PR
   goes through the standard loop. Do not open a separate planning PR.

## Local references

- `docs/eleva-v3/{market-expansion-playbook,notifications-architecture,tech-debt-backlog,feature-flag-rollout-plan}.md`
- `docs/eleva-v3/execution-plan/phases/{04,07,09,10,11,13,15}-*.md` (origins of deferred items)

## Copy-paste prompt

This prompt is a **promotion template**: the only two placeholders are `<N>` (the backlog number
from the table above, e.g. `4`) and `<slug>` (kebab-case of the item title, e.g.
`marketplace-search-v2`). Replace both everywhere before pasting; everything else is fixed. The
first line of the task restates the item title and its Origin documents from the table so the
pasted prompt identifies the work without this file.

````text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(/Users/<you>/…/elevacare-monorepo). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc and the skills under .cursor/skills/ that match the files
   you will touch (api-first-agentic, audit-wiring, stripe-webhooks, eleva-icons, coderabbit-review).
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 5, 6, 7, 8 and this phase file in
   full (docs/eleva-v3/execution-plan/phases/16-post-launch-backlog.md).
3. Read every file under "Local references" of this phase and the "Origin" documents listed in
   the backlog table row 16.<N> of that file. Pull every library the promoted item needs through Context7
   (resolve-library-id then query-docs) and prefer those docs over memory for Next.js 16, Better
   Auth, Drizzle, Stripe, Daily, Resend, Twilio, next-intl, Vercel Flags/Workflows, Playwright,
   CodeRabbit.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-16.<N>/<slug>
- Implement the deliverables in the order listed. Keep the PR under 150 reviewable files; split
  into phase-16.<N>.1 / phase-16.<N>.2 branches if needed.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
- Commit with Conventional Commits (scope p16.<N>). Run: pnpm review:branch -> fix -> repeat until clean.
- git push -u origin <branch> && gh pr create --base main with the PR body template from
  docs/eleva-v3/execution-plan/README.md section 8.
- Loop: wait for CodeRabbit GitHub App review + CI; for each comment fix+push or reply
  "Not actionable because ..."; re-run pnpm review:branch; continue until zero unresolved
  comments and all checks green. Request human approval from @rodrigobarona.
- gh pr merge --squash --delete-branch; git checkout main && git pull.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for pt/en/es, cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 16 TASK — Promote backlog item 16.<N> into a phase and deliver it on one branch / one PR.

Item: row 16.<N> of the backlog table in
docs/eleva-v3/execution-plan/phases/16-post-launch-backlog.md (title, Origin documents and Notes
are authoritative; copy the title verbatim into the new phase file heading). Phase 16 is a
backlog, not a build phase. Deliver in this order, all on branch phase-16.<N>/<slug>:

1. Planning commit (docs(p16.<N>): ...), first on the branch:
   a. Write docs/eleva-v3/execution-plan/phases/16-<N>-<slug>.md with the same structure as the
      other phase files: metadata table (Branch phase-16.<N>/<slug>, Depends on, Effort, Touches,
      Exit gate), Why this phase exists, Scope (in/out), Deliverables with exact file paths,
      Acceptance criteria checklist, Tests, Docs to update, Local references, External docs
      (Context7 library IDs), Risks, and a "## Copy-paste prompt" ```text block that follows the
      universal preamble from README section 7 (same steps, order and hard constraints) followed
      by the item-specific task.
   b. If the item changes a locked decision (README section 2), add the decision-log.md entry
      and a new ADR under docs/eleva-v3/adrs/ (next free number) and reference both from the
      phase file.
   c. Add the row to README section 5 (branch, effort, dependencies, file link); run
      pnpm docs:execution-plan:html and commit the regenerated index.html.
2. Implementation commits: execute the prompt you just wrote, end to end, on the same branch.
3. Open the single PR with the README section 8 template; the PR body links the new phase file
   and ticks its acceptance criteria.

Acceptance: the new phase file exists and renders in index.html; README section 5 lists it; any
decision change has a decision-log entry + ADR; the item's own acceptance criteria are met; CLI
and GitHub App reviews are clean; PR merged through the full loop.

Report: new phase file path, decision-log/ADR links (if any), CodeRabbit CLI finding counts per
run, PR URL, and anything you could not complete with the reason.
````
