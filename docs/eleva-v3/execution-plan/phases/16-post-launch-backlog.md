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
external docs, copy-paste prompt) into `phases/16-<N>-<slug>.md`, add it to the README phase index,
and run the standard loop from README section 4.

## Backlog (ordered by expected priority)

| #     | Item                                                                                                                                                                                                                                                                                                                 | Origin                                                                                                                                                                                                                                                           | Notes                                                                                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16.1  | **Spain launch** (`es-ES` legal texts, Spanish IVA rules, health-sector disclaimers, Stripe payment methods for ES, pricing localisation)                                                                                                                                                                            | `docs/eleva-v3/adrs/ADR-012-portugal-first-launch.md` (ES expansion section), `docs/eleva-v3/roadmap-and-milestones.md`                                                                                                                                          | Requires accountant sign-off for ES IVA; Tier 1 invoices to ES experts (intra-EU reverse charge).                                                                                                                       |
| 16.2  | **Brazil (`pt-BR`) content + payments discovery**                                                                                                                                                                                                                                                                    | `docs/eleva-v3/decision-log.md` (pt-BR alias decision), `docs/eleva-v3/adrs/ADR-012-portugal-first-launch.md`                                                                                                                                                    | Stripe BR is a separate platform account; do not assume Connect parity. Discovery only.                                                                                                                                 |
| 16.3  | **Academy content platform** (`apps/academy`, `@eleva/academy`: courses, lessons, enrolments, certificates, Stripe products for courses)                                                                                                                                                                             | `docs/eleva-v3/academy-strategy-spec.md`, `docs/eleva-v3/roadmap-and-milestones.md`                                                                                                                                                                              | Reuse Tier 1/2 invoicing and payout engine; recorded lessons hosted on Vercel Blob private + signed URLs or Mux (new ADR).                                                                                              |
| 16.4  | **Marketplace search + discovery v2** (Typesense/Meilisearch or Neon `pg_search`, filters by specialty/language/price/availability, ranking)                                                                                                                                                                         | `docs/eleva-v3/search-and-discovery-spec.md`, `docs/eleva-v3/execution-plan/phases/04-public-marketplace-booking.md` (SQL search kept simple)                                                                                                                    | New ADR for search engine choice; EU hosting required.                                                                                                                                                                  |
| 16.5  | **Notifications Lane 2** (marketing/lifecycle campaigns: onboarding drip, re-engagement, digest emails, consent-gated)                                                                                                                                                                                               | `docs/eleva-v3/notifications-spec.md`, `docs/eleva-v3/adrs/ADR-006-notifications-two-lane.md`                                                                                                                                                                    | Resend Broadcasts or Customer.io EU; strict consent gating (PostHog cohorts).                                                                                                                                           |
| 16.6  | **Mobile apps** (Expo + Better Auth `expo` plugin, Daily React Native SDK)                                                                                                                                                                                                                                           | `docs/eleva-v3/mobile-integration-spec.md`, `docs/eleva-v3/roadmap-and-milestones.md` (Milestone 7)                                                                                                                                                              | Better Auth `expo` plugin and Daily RN SDK both exist; needs API key/bearer flows from Phase 2.                                                                                                                         |
| 16.7  | **AI reports GA** (graduate `ff.ai_reports_beta`; structured templates per specialty; member-facing summaries; evaluation harness)                                                                                                                                                                                   | `docs/eleva-v3/ai-reporting-spec.md`, `docs/eleva-v3/execution-plan/phases/10-records-crm-ai.md` (beta flag)                                                                                                                                                     | Requires DPIA update and consent copy review; Vercel AI Gateway model pinning.                                                                                                                                          |
| 16.8  | **Session recording + transcription — the only home for this feature** (Daily HIPAA cloud recording into a disposable EU AWS S3 landing zone, pull-encrypt-store into the private Blob store via `@eleva/storage`, `session_recording` consent kind, `syncRoomRecording` fencing, transcript -> AI draft, retention) | `docs/eleva-v3/execution-plan/phases/09-video-daily.md` (recording off, PR 09.0 confirms the domain setting), `docs/eleva-v3/execution-plan/phases/10-records-crm-ai.md` (stripped here by the 2026-09 amendment), `docs/eleva-v3/compliance-data-governance.md` | Gated on **D-08** (storage decision: AWS S3 EU landing zone with IAM role trust for Daily; Vercel Blob, Neon object storage and R2 are not accepted Daily destinations) + DPO sign-off; see the 16.8 design note below. |
| 16.9  | **Clinic advanced features** (rooms/locations, intake forms, shared calendars, clinic-level reporting, SSO for enterprise clinics via Better Auth `sso` plugin)                                                                                                                                                      | `docs/eleva-v3/organization-and-clinic-model.md`, `docs/eleva-v3/execution-plan/phases/11-team-clinics.md`                                                                                                                                                       | SSO plugin brings back part of what WorkOS offered, only for clinics that need it.                                                                                                                                      |
| 16.10 | **Expert marketplace growth tools** (referral codes, coupons via Stripe Coupons/Promotion Codes, gift sessions, packages/bundles)                                                                                                                                                                                    | `docs/eleva-v3/roadmap-and-milestones.md`, `docs/eleva-v3/payments-payouts-spec.md`                                                                                                                                                                              | Packages interact with payout eligibility and Tier 2 invoicing (one invoice per package).                                                                                                                               |
| 16.11 | **Member subscriptions / memberships** (recurring member plans, credits)                                                                                                                                                                                                                                             | `docs/eleva-v3/roadmap-and-milestones.md` (pack/subscription baseline), `docs/eleva-v3/payments-payouts-spec.md`                                                                                                                                                 | Hybrid monetization v2; new ADR.                                                                                                                                                                                        |
| 16.12 | **Moloni + additional Tier 2 adapters** (InvoiceXpress, Vendus), SAF-T export                                                                                                                                                                                                                                        | `docs/eleva-v3/execution-plan/phases/07-invoicing-toconline.md` (adapter registry), `docs/eleva-v3/toconline-api-reference.md`                                                                                                                                   | Adapter interface already in `@eleva/accounting`; each adapter is a small PR.                                                                                                                                           |
| 16.13 | **Agentic surfaces** (MCP server exposing `apps/api` OpenAPI as tools with API-key auth; agent-friendly booking assistant)                                                                                                                                                                                           | `docs/eleva-v3/api-first-architecture.md`, `docs/eleva-v3/api-contract-spec.md`                                                                                                                                                                                  | Builds on `apiKey` + `openAPI` plugins from Phase 2; rate limits per key.                                                                                                                                               |
| 16.14 | **Public status page + trust center** (SLOs, subprocessors, security posture)                                                                                                                                                                                                                                        | `docs/eleva-v3/execution-plan/phases/13-hardening-observability.md`, `docs/eleva-v3/service-level-objectives.md`, `docs/eleva-v3/ops-observability-spec.md`                                                                                                      | BetterStack status page + `apps/docs` trust pages.                                                                                                                                                                      |
| 16.15 | **Tech-debt backlog burn-down**                                                                                                                                                                                                                                                                                      | `docs/eleva-v3/tech-debt-backlog.md`                                                                                                                                                                                                                             | Review after each launch retro; items with owner + due phase.                                                                                                                                                           |
| 16.16 | **MVP decommission finalisation** (+30 days: archive Neon branch, delete migration schema, remove redirect map entries older than 12 months)                                                                                                                                                                         | `docs/eleva-v3/execution-plan/phases/15-launch-cutover.md`, `docs/eleva-v3/execution-plan/phases/14-mvp-migration.md`                                                                                                                                            | Requires checksum verification record from Phase 15.                                                                                                                                                                    |
| 16.17 | **Intake and questionnaire form builder** (Plate-based visual form editor in `@eleva/editor`; per event type / per mode intake forms; answers encrypted as records; reusable form templates in the Phase 10 template library)                                                                                        | `docs/eleva-v3/execution-plan/phases/04b-expert-offer-builder.md` (Out), `docs/eleva-v3/execution-plan/phases/10-records-crm-ai.md` (template library), `docs/eleva-v3/scheduling-booking-spec.md` (`intake_questions`)                                          | Depends on `@eleva/editor` (4B) and records encryption (10); clinic intake in 16.9 reuses it.                                                                                                                           |
| 16.18 | **Brand palette and type-scale refresh** (proposal + decision on evolving the Eleva palette, typography and motion; token migration in `@eleva/ui`; before/after screenshots of every app)                                                                                                                           | `docs/eleva-v3/design-system-spec.md`, `docs/eleva-v3/brand-book/README.md`, `docs/eleva-v3/execution-plan/README.md` (section 4 rule 10)                                                                                                                        | Founder decision required (`decision-log.md`); tokens-only change so it lands as one PR after the decision.                                                                                                             |

## 16.8 design note — session recording (moved here from Phase 10, 2026-09 amendment)

Daily's HIPAA mode writes cloud recordings only to a **customer-owned AWS S3 bucket** whose
bucket policy trusts Daily's AWS account via an IAM role (`recordings_bucket` room/domain
property with `bucket_name`, `bucket_region`, `assume_role_arn`). Vercel Blob, Neon object
storage and Cloudflare R2 are **not** accepted destinations, so the compliant design is two-hop:

1. **Landing zone (mailbox, not storage)** — one small S3 bucket in an EU region (`eu-west-1` or
   `eu-south-2`), SSE-KMS, **versioning ON (Daily requires it — its role lists
   `s3:ListBucketVersions`/`s3:GetObjectVersion`)**, lifecycle rule expiring current AND
   non-current versions after 72 h plus aborting incomplete multipart uploads after 1 day, Object
   Lock off, public access blocked. IAM: a role trusted by Daily's AWS account `291871421005` with
   the external id = our Daily domain name and max session 12 h, attached to the **write-only**
   Daily policy from Daily's docs (`s3:PutObject`, `s3:ListBucketMultipartUploads`,
   `s3:AbortMultipartUpload`, `s3:ListMultipartUploadParts` — no `GetObject`, so Daily can never
   read a recording back; set `allow_api_access: false` on the `recordings_bucket` property) and a
   second role for the Eleva workflow (`GetObject`, `DeleteObject`, `ListBucket`). Provisioned by
   `infra/aws/recordings-landing-zone.ts` (idempotent, dry-run default) and validated against the
   permission table in Daily's custom-S3 guide before D-08 is signed. Recorded as **D-08** with
   the account id, region and role ARNs.
2. **System of record** — on Daily's `recording.ready-to-download` and
   `transcript.ready-to-download` webhook events (Daily's exact type names; the handler maps the
   latter to the internal domain event `transcript.ready` — a recorded fixture of each provider
   payload is a test) a
   `@eleva/workflows` job (QStash, idempotent on the Daily recording id) pulls the object with the
   workflow role, encrypts the transcript with `encryptForOrg(expertOrgId)` (envelope, per-org
   DEK), stores it through `@eleva/storage` in the **private** Vercel Blob store (region confirmed
   EU in D-08), writes `records.kind = transcript` (add `transcript` to `RECORD_KINDS` here), then
   **deletes the S3 object**. The raw video is deleted from S3 after the transcript is stored
   unless `ff.session_recording_keep` (default off, DPO decision) — nothing PHI-bearing stays in
   S3 beyond the transfer window. Retention: transcripts 2 y (`data-retention-export-matrix.md`).
3. **Consent** — add `session_recording` to `CONSENT_KINDS`; both the expert and the member must
   grant it (join-page banner; withdrawable at any time); the consent boolean drives Daily's
   recording mode through the fenced sync below, never a raw flag.
4. **AI draft from transcript** — `draftSessionReport` (Phase 10, typed-notes input) gains a
   `transcriptRecordId` input behind `ff.session_recording`; same `PHI_APPROVED_MODELS` rule.

### Room recording sync — fencing design (verbatim from the original Phase 10 text)

Phase 9 creates the room at booking confirmation with `enable_recording: false`, and consent is
captured on the join page, so recording is enabled by an **idempotent room update**, not at
creation: `syncRoomRecording(bookingId)` in `@eleva/video` reads the flag + both consents and
calls Daily `updateRoom(name, { properties: { enable_recording: desired ? "cloud" : false } })`
— the consent boolean maps to Daily's recording mode string, never passed raw — only when the desired
value differs from `sessions.recording_enabled`; it runs on every consent change and again in
the `join` route before the token is minted, so the state is correct whenever anyone enters
— a room is never re-created and a withdrawn consent flips it back to `false` the same way.
The read-compare-update is serialized per booking **without holding a lock across the
provider call**: step 1 (short transaction, `SELECT ... FOR UPDATE` on the `sessions` row)
re-reads both consents, computes `desired`, and **only if `desired <> recording_desired`**
writes `recording_desired = desired` and increments `recording_state_version` (v), then
commits — a consent write that changes nothing is a no-op **only when the row is already
converged** (`recording_enabled = recording_desired` and the last read-back provider version
equals the row version); if the row is not converged (an earlier Daily call timed out) the
write skips the version bump but still schedules the fenced sync for the current version, so a
stale provider state is always retried and never parks joins on `RECORDING_STATE_PENDING`
(tests: repeated identical grants on a converged row leave the version unchanged and make zero
Daily calls; identical grant after a Daily timeout triggers exactly one sync that converges the
row); step 2 calls Daily `updateRoom` with a 10 s timeout and no DB lock held, **fenced** so an
older call can never land after a newer one. Daily room `properties` are a closed set — there
is no `meta` field and no provider-side version, so **all fencing state is Eleva-owned** on the
`sessions` row (`recording_desired`, `recording_enabled`, `recording_state_version`,
`recording_verified_at`): (a) provider calls for one booking are single-flight behind a Redis
mutex `recording-sync:{bookingId}` (15 s TTL, held only around the Daily call — consent writes
and joins never wait on it) and a worker that acquires the mutex re-reads the current version
`v` and desired state and applies the CURRENT desired state, not the one it started with, so
two calls for one room never overlap and the last call always carries the newest intent; (b)
after `updateRoom` the worker reads the room back (`GET /rooms/{name}`) and accepts only when
the returned `config.enable_recording` equals the desired value it just sent; step 3 persists
`recording_enabled = <read-back value>`, `recording_verified_at = now()` with a
compare-and-swap `WHERE recording_state_version = v` — zero rows means a newer desired state
superseded this call, so the worker re-runs from step 1 instead of writing. A Daily outage
therefore never blocks consent writes or joins on a row lock. The `join` route refuses to mint
a token while `recording_desired <> recording_enabled` or while `recording_verified_at` is
older than the row's last `recording_state_version` change (it re-runs the sync first, and
returns 503 RECORDING_STATE_PENDING if Daily is still unreachable), so nobody joins a room whose
provider-side recording state is unknown or stale. Tests: grant/withdraw race (withdrawal
committed last) -> final Daily state and row both `false`; out-of-order completion (older
enable call finishes after the newer withdraw call) -> the mutex + re-read means the older
intent is never sent; a simulated stale write (read-back disagrees with desired) -> row not
persisted, sync re-runs, join returns 503 until the read-back matches, never a token;
Daily timeout during step 2 -> consent write completes in < 100 ms and join returns 503
rather than minting.

### Implementation prompt fragment (append to the 16.8 phase file's task list)

```text
Recording/transcription behind flags: Phase 9 rooms are created at confirmation with
   enable_recording false and consent arrives later on the join page, so add
   syncRoomRecording(bookingId) to @eleva/video (this phase's migration adds
   sessions.recording_enabled boolean default false, sessions.recording_desired boolean default
   false and sessions.recording_state_version int default 0 to the Phase 9 table): desired =
   ff.session_recording on AND both
   consents (expert + member) granted; if desired !== sessions.recording_enabled call Daily
   updateRoom(name, { properties: { enable_recording: desired ? "cloud" : false } }) and persist
   the new value with the three-step protocol from the fencing design above (claim desired +
   version under a short FOR UPDATE; call Daily with no DB lock, single-flight per booking
   behind Redis mutex recording-sync:{bookingId} (15 s TTL) applying the CURRENT desired state,
   then GET /rooms/{name} read-back accepted only when config.enable_recording equals the value
   just sent (Daily room properties are a closed set: NO meta field, NO provider-side version —
   all fencing state lives on the sessions row: recording_desired, recording_enabled,
   recording_state_version, recording_verified_at); CAS on the version; join refuses to mint
   while recording_desired <> recording_enabled or recording_verified_at predates the last
   version change) (idempotent — no call when unchanged; race test: grant/withdraw concurrently
   -> final state false; stale read-back test -> row not persisted, sync re-runs, join returns
   503 until the read-back matches; Daily timeout test -> consent write < 100 ms, join 503
   RECORDING_STATE_PENDING); invoke it from
   the consent write path
   (PUT /me/consents, expert consent toggle) and from POST /sessions/[bookingId]/join before
   minting the token; createSessionRoom keeps enable_recording: false at creation (Phase 9 payload field; there is no separate recording option). Tests: consent
   after room creation -> exactly one updateRoom call; withdrawn consent -> flipped back; join with
   state already correct -> zero Daily calls. Handle Daily webhooks recording.ready-to-download and
   transcript.ready-to-download (Daily's exact event type names — map the latter to the internal
   domain event transcript.ready; recorded fixture per provider payload; signature verified,
   idempotent) -> pull the recording/transcript object from the S3 landing zone (never from a
   Daily-hosted URL) -> store as records.kind = transcript (encrypted, private Blob store) ->
   DeleteObject in S3 once stored (video too, unless ff.session_recording_keep) ->
   emitDomainEvent("transcript.ready").
   Provision the S3 landing zone with infra/aws/recordings-landing-zone.ts (bucket with
   VERSIONING ENABLED — Daily requires it —, KMS key, lifecycle expiring current + non-current
   versions at 72h and aborting incomplete multipart uploads at 1 day, Daily role trusted by
   account 291871421005 with external id = our Daily domain and the write-only policy from
   Daily's custom-S3 guide (PutObject, ListBucketMultipartUploads, AbortMultipartUpload,
   ListMultipartUploadParts — no GetObject), a separate workflow role with Get/Delete/List;
   dry-run default, --apply; the script asserts the created policy matches Daily's documented
   permission table before exiting 0); set Daily's recordings_bucket (bucket_name,
   bucket_region, assume_role_arn, allow_api_access: false) on the domain or per room and
   confirm Daily's daily-co-test-upload.txt probe lands; the workflow pulls with
   @aws-sdk/client-s3 (only importer: packages/video/src/
   server/recordings-landing-zone.ts), encrypts, stores via @eleva/storage private store, then
   DeleteObject; alert if any object in the bucket is older than 24h (BetterStack heartbeat on
   a daily sweep). Tests: mocked S3 + Daily webhooks end to end, idempotent on recording id,
   object deleted after store, consent withdrawal mid-session flips recording off.
```

## How to promote an item

1. Create `docs/eleva-v3/execution-plan/phases/16-<N>-<slug>.md` with the same section structure
   as every other phase file (metadata table, Why this phase exists, Scope, Deliverables,
   Acceptance criteria, Tests, Docs to update, Local references, External docs, Risks, Copy-paste
   prompt — the structure defined in Phase 0 prompt deliverable 2 and spelled out again in step 1a
   of the prompt below; copy `phases/05-member-app.md` as the starting skeleton).
2. Add the row to README section 5 with branch `phase-16.N/<slug>` and dependencies.
3. Add a `docs/eleva-v3/decision-log.md` entry for **every** promoted item (date, item id, what it
   operationalizes, the phase file link). A new ADR is required only when the item changes
   architecture or a locked decision (README section 2); then the ADR is written first and the
   log entry references it.
4. Run `pnpm docs:execution-plan:html` and commit the regenerated `index.html` with the phase file.
5. One branch, one PR (README section 4 rule 1): the phase file, README row, decision-log/ADR
   changes and the regenerated `index.html` are the **first commit** (`docs(p16.N): ...`) on
   `phase-16.N/<slug>`; the implementation commits follow on the same branch and the single PR
   goes through the standard loop. Do not open a separate planning PR.

## Local references

- `docs/eleva-v3/{tech-debt-backlog,feature-flag-rollout-plan,roadmap-and-milestones,notifications-spec}.md`,
  `docs/eleva-v3/adrs/{ADR-006-notifications-two-lane,ADR-012-portugal-first-launch}.md`
- `docs/eleva-v3/execution-plan/phases/{04,07,09,10,11,13,15}-*.md` (origins of deferred items)

## Copy-paste prompt

This prompt is a **promotion template**: the only two placeholders are `<N>` (the backlog number
from the table above, e.g. `4`) and `<slug>` (kebab-case of the item title, e.g.
`marketplace-search-v2`). Replace both everywhere before pasting; everything else is fixed. The
task section embeds the full backlog table (title, origin, notes) so the pasted prompt identifies
the work without this file; when you add or change a backlog row, update the embedded list in the
same commit.

````text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc and the skills under .cursor/skills/ that match the files
   you will touch (api-first-agentic, audit-wiring, stripe-webhooks, eleva-icons, coderabbit-review).
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 5, 6, 7, 8 and this phase file in
   full (docs/eleva-v3/execution-plan/phases/16-post-launch-backlog.md).
3. Read every file under "Local references" of this phase and every repository path listed in
   the "Origin" column of backlog row 16.<N> (all origins are repository-relative file paths;
   a parenthesised note after a path names the section to focus on). Pull every library the promoted item needs through Context7
   (resolve-library-id then query-docs) and prefer those docs over memory for Next.js 16, Better
   Auth, Drizzle, Stripe, Daily, Resend, Twilio, next-intl, Vercel Flags/Workflows, Playwright,
   CodeRabbit.

Workflow (mandatory) — this is the outer loop; the "PHASE 16 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-16.<N>/<slug>
- Implement the deliverables of the PHASE 16 TASK below in the order listed (planning commit
  first, then implementation). One branch, one PR — no split branches: if the promoted item
  cannot stay <= 60 files / 800 lines (and never >= 100 reviewable files), split the *backlog
  item* into 16.<N>a / 16.<N>b rows in
  the table first (each with its own phase file, branch and PR), never the branch.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
  or the review cap is reached (README section 4 rule 4: max 3 rounds, zero Critical/Major left,
  remaining Minor/Trivial listed in the PR body "Deferred findings" table with a reason each).
- Commit with Conventional Commits (scope p16.<N>). Run: pnpm review:branch -> fix -> repeat until
  clean or the cap (max 2 rounds, same exit rule: zero Critical/Major, remaining Minor/Trivial
  deferred with a reason each).
- git push -u origin HEAD && gh pr create --base main with the PR body template from
  docs/eleva-v3/execution-plan/README.md section 8.
- Loop: wait for CodeRabbit GitHub App review + CI; for each comment fix+push or reply
  "Not actionable because ..."; re-run pnpm review:branch; continue until zero unresolved
  comments and all checks green, or after 2 App rounds escalate the leftovers to the reviewer
  (README section 4 rule 6). Request human approval from @rodrigobarona.
- gh pr merge --squash --delete-branch; git checkout main && git pull.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for every app's required locales (pt/en/es; apps/admin
pt/en only — decision-log staff-only exception), cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only. Never commit production
secrets, ids of live customers, or PHI into the repo; evidence files (screenshots, logs, exports
attached to the PR) must be redacted; any script that can touch production data must carry the
Phase 14 production guard and require --target production plus interactive confirmation.

PHASE 16 TASK — Promote backlog item 16.<N> into a phase and deliver it on one branch / one PR.

Item: row 16.<N> of this backlog (copied here so the prompt stands alone; the table in
docs/eleva-v3/execution-plan/phases/16-post-launch-backlog.md is the SSOT if they ever differ;
copy the title verbatim into the new phase file heading):
  16.1  Spain launch (es-ES legal texts, Spanish IVA rules, health-sector disclaimers, Stripe
        payment methods for ES, pricing localisation) — origin
        docs/eleva-v3/adrs/ADR-012-portugal-first-launch.md (ES expansion section),
        docs/eleva-v3/roadmap-and-milestones.md; needs accountant sign-off for ES IVA; Tier 1 invoices to ES experts use
        intra-EU reverse charge.
  16.2  Brazil (pt-BR) content + payments discovery — origin docs/eleva-v3/decision-log.md
        (pt-BR alias decision), docs/eleva-v3/adrs/ADR-012-portugal-first-launch.md;
        Stripe BR is a separate platform account; discovery only.
  16.3  Academy content platform (apps/academy, @eleva/academy: courses, lessons, enrolments,
        certificates, Stripe products for courses) — origin
        docs/eleva-v3/academy-strategy-spec.md, docs/eleva-v3/roadmap-and-milestones.md; reuse Tier 1/2
        invoicing + payout engine; recorded lessons on Vercel Blob private + signed URLs or Mux
        (new ADR).
  16.4  Marketplace search + discovery v2 (Typesense/Meilisearch or Neon pg_search; filters by
        specialty/language/price/availability; ranking) — origin
        docs/eleva-v3/search-and-discovery-spec.md,
        docs/eleva-v3/execution-plan/phases/04-public-marketplace-booking.md (simple SQL search);
        new ADR for the engine; EU hosting required.
  16.5  Notifications Lane 2 (marketing/lifecycle campaigns: onboarding drip, re-engagement,
        digests, consent-gated) — origin docs/eleva-v3/notifications-spec.md,
        docs/eleva-v3/adrs/ADR-006-notifications-two-lane.md; Resend Broadcasts or
        Customer.io EU; strict consent gating via PostHog cohorts.
  16.6  Mobile apps (Expo + Better Auth expo plugin, Daily React Native SDK) — origin
        docs/eleva-v3/mobile-integration-spec.md, docs/eleva-v3/roadmap-and-milestones.md
        (Milestone 7); needs the API key/bearer flows from Phase 2.
  16.7  AI reports GA (graduate ff.ai_reports_beta; structured templates per specialty;
        member-facing summaries; evaluation harness) — origin docs/eleva-v3/ai-reporting-spec.md,
        docs/eleva-v3/execution-plan/phases/10-records-crm-ai.md (beta flag); DPIA update, consent
        copy review, AI Gateway model pinning.
  16.8  Session recording + transcription — THE ONLY HOME for recording (Phase 9 keeps
        recording off; Phase 10 has no recording code). Origin
        docs/eleva-v3/execution-plan/phases/09-video-daily.md,
        docs/eleva-v3/execution-plan/phases/10-records-crm-ai.md,
        docs/eleva-v3/compliance-data-governance.md. Gated on D-08 in decision-log.md (storage)
        and DPO sign-off. Branch phase-16.8/session-recording. When promoting, copy the three
        sections "16.8 design note", "Room recording sync — fencing design" and "Implementation
        prompt fragment" of docs/eleva-v3/execution-plan/phases/16-post-launch-backlog.md
        VERBATIM into the new phase file (they are its scope, task list and acceptance criteria;
        deliverable paths: packages/video/src/recording.ts, packages/workflows/src/video/
        recording-ingest.ts, infra/aws/recording-landing-zone.ts, packages/db migration adding
        sessions.recording_* and records.kind transcript): S3 EU
        landing zone as a mailbox, pull-encrypt-store into the private Blob store, delete the
        S3 object, session_recording consent kind, the syncRoomRecording fencing design,
        transcript -> records.kind transcript -> draftSessionReport, retention 2y for
        transcripts, and the ff.session_recording flag (default off).
  16.9  Clinic advanced features (rooms/locations, intake forms, shared calendars, clinic-level
        reporting, enterprise SSO via Better Auth sso plugin) — origin
        docs/eleva-v3/organization-and-clinic-model.md,
        docs/eleva-v3/execution-plan/phases/11-team-clinics.md (minimum viable).
  16.10 Expert marketplace growth tools (referral codes, Stripe Coupons/Promotion Codes, gift sessions,
        packages/bundles) — origin docs/eleva-v3/roadmap-and-milestones.md,
        docs/eleva-v3/payments-payouts-spec.md; packages interact with payout eligibility and
        Tier 2 invoicing (one invoice per package).
  16.11 Member subscriptions / memberships (recurring plans, credits) — origin
        docs/eleva-v3/roadmap-and-milestones.md (pack/subscription baseline),
        docs/eleva-v3/payments-payouts-spec.md; hybrid monetization v2; new ADR.
  16.12 Moloni + additional Tier 2 adapters (InvoiceXpress, Vendus), SAF-T export — origin
        docs/eleva-v3/execution-plan/phases/07-invoicing-toconline.md (adapter registry),
        docs/eleva-v3/toconline-api-reference.md; adapter interface already in @eleva/accounting.
  16.13 Agentic surfaces (MCP server exposing the apps/api OpenAPI as tools with API-key auth;
        agent-friendly booking assistant) — origin docs/eleva-v3/api-first-architecture.md,
        docs/eleva-v3/api-contract-spec.md; builds on apiKey +
        openAPI plugins from Phase 2; rate limits per key.
  16.14 Public status page + trust center (SLOs, subprocessors, security posture) — origin
        docs/eleva-v3/execution-plan/phases/13-hardening-observability.md,
        docs/eleva-v3/service-level-objectives.md, docs/eleva-v3/ops-observability-spec.md;
        BetterStack status page + apps/docs trust pages.
  16.15 Tech-debt backlog burn-down — origin docs/eleva-v3/tech-debt-backlog.md; review after each launch
        retro; items with owner + due phase.
  16.16 MVP decommission finalisation (+30 days: archive Neon branch, delete migration schema,
        remove redirect-map entries older than 12 months) — origin
        docs/eleva-v3/execution-plan/phases/15-launch-cutover.md,
        docs/eleva-v3/execution-plan/phases/14-mvp-migration.md; requires the
        checksum verification record from Phase 15.
  16.17 Intake and questionnaire form builder (Plate-based visual form editor in @eleva/editor;
        per event type / per mode intake forms; answers encrypted as records; reusable form
        templates in the Phase 10 template library) — origin
        docs/eleva-v3/execution-plan/phases/04b-expert-offer-builder.md (Out of scope list),
        docs/eleva-v3/execution-plan/phases/10-records-crm-ai.md (template library),
        docs/eleva-v3/scheduling-booking-spec.md (intake_questions); depends on @eleva/editor
        (Phase 4B) and records encryption (Phase 10); the clinic intake in 16.9 reuses it instead
        of building its own forms.
  16.18 Brand palette and type-scale refresh (proposal + decision on evolving the Eleva palette,
        typography and motion; token migration in @eleva/ui; before/after screenshots of every
        app) — origin docs/eleva-v3/design-system-spec.md, docs/eleva-v3/brand-book/README.md,
        docs/eleva-v3/execution-plan/README.md section 4 rule 10; founder decision required and
        recorded in docs/eleva-v3/decision-log.md BEFORE any code; tokens-only change so it lands
        as one PR after the decision (no per-app colour overrides).
Phase 16 is a backlog, not a build phase. Deliver in this order, all on branch phase-16.<N>/<slug>:

STOP GATE for <N> = 18 (brand palette): do not create the branch or touch a single token until a
dated "Brand palette v2 — approved" entry signed by the founder exists in
docs/eleva-v3/decision-log.md with the approved palette, type scale and motion values attached.
If it is missing, the only allowed output is the proposal document
(docs/eleva-v3/brand-book/palette-v2-proposal.md with rationale, contrast tables and mockups) on
its own docs branch; stop and report. The implementation PR stays tokens-only in @eleva/ui.

1. Planning commit (docs(p16.<N>): ...), first on the branch:
   a. Write docs/eleva-v3/execution-plan/phases/16-<N>-<slug>.md with the same structure as the
      other phase files: metadata table (Branch phase-16.<N>/<slug>, Depends on, Effort, Touches,
      Exit gate), Why this phase exists, Scope (in/out), Deliverables with exact file paths,
      Acceptance criteria checklist, Tests, Docs to update, Local references, External docs
      (Context7 library IDs), Risks, and a "## Copy-paste prompt" ```text block that follows the
      universal preamble from README section 7 (same steps, order and hard constraints) followed
      by the item-specific task.
   b. Add the docs/eleva-v3/decision-log.md entry for the promoted item (mandatory for every item: date, id,
      what it operationalizes, link to the phase file). Only if the item changes architecture or
      a locked decision (README section 2), also add a new ADR under docs/eleva-v3/adrs/ (next
      free number) first and reference it from the log entry and the phase file.
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
