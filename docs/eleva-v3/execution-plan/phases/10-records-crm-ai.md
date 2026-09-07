# Phase 10 — Records/PHI, CRM, AI reports beta

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-10/records-crm-ai` (split: `phase-10.1/records-consent-retention`, `phase-10.2/crm-ai-reports`)                                                                                                                                                                                                                                                                                                            |
| Depends on | Phase 9, Phase 4B (`@eleva/editor`, `approved-models` allow-list)                                                                                                                                                                                                                                                                                                                                                 |
| Effort     | 2 weeks                                                                                                                                                                                                                                                                                                                                                                                                           |
| Touches    | `packages/db/src/schema/main/{records,session-documents,expert-notes,consents,crm}.ts`, `packages/encryption` (usage), `packages/storage` (private store), `packages/compliance/**` (retention jobs, DSAR collectors), `packages/crm/**`, `packages/ai/**`, `packages/encryption` (KEK/DEK operations), `apps/api/src/app/{records,notes,crm,ai,workflows}/**`, `apps/expert/**`, `apps/app/**`, `packages/flags` |
| Exit gate  | Expert writes encrypted notes during/after a session, uploads documents to the private store, publishes a report the member can read via the app; retention jobs purge on schedule; consent captured; AI draft (behind `ff.ai_reports_beta`) from typed notes reviewed and published by the expert; KEK rotation job proven; no PHI in Sentry/logs                                                                |

## Why this phase exists

Clinical value and trust: encrypted records, member-visible reports, consent and retention are
core to ERS/GDPR/HIPAA posture. CRM gives experts follow-up tools. AI drafting is the first
differentiator and must ship behind a flag with strict PHI boundaries (ADR-009).

## Scope

In:

- **Records** (`records`: id, expert_org_id, member_user_id, booking_id nullable, kind
  `note|report|document_ref|ai_draft` (`transcript` is added by Phase 16.8; one shared `RECORD_KINDS` const in
  `packages/db/src/schema/main/records.ts`, reused by the migration enum, API Zod schemas,
  `@eleva/audit` unions and tests), `title_encrypted` + `body_encrypted` (envelope,
  `encryptForOrg(expertOrgId)`; naming convention `<field>_encrypted` everywhere),
  `published_at` (member-visible when set), `version`, `created_by`, timestamps;
  `session_documents`: private Blob pathname, mime, size, `metadata_encrypted`, uploaded_by,
  scope `expert_only|shared`). RLS — two different member-read predicates because the tables
  have different visibility columns. Expert-side read is **one policy (A) shared by both
  tables and it is the D-11 model, not "whole org"**: `expert_org_id = eleva.org_id AND
(<author> = eleva.user_id OR (organizations.clinic_shared_records AND NOT EXISTS
record_access_optouts(member_user_id, expert_org_id)))` where the author column is
  `created_by` on `records` and `uploaded_by` on `session_documents` (same predicate shape, two
  concrete policies — one per table, each with its own rls-classes test) — in a solo Expert org
  that collapses to the author; in a clinic it opens to peers only behind the Phase 11 toggle and
  the member's opt-out; writes are author-only (`created_by` / `uploaded_by` respectively). Member
  read (B) differs per table: `records`: only
  `published_at IS NOT NULL AND member_user_id = current_setting('eleva.user_id')`.
  `session_documents`: only `scope = 'shared'` rows of bookings
  where they are the member (`session_documents` has **no** `published_at`). Both member
  policies use the `eleva.user_id` setting.
- **Consent**: `consents` (table from Phase 4, marketing kind from Phase 5) gains `ai_processing`,
  captured at booking (Phase 4 form) and at session start (join page banner); `session_recording`
  is **not** added here — it arrives with the recording pipeline in Phase 16.8;
  versioned legal texts in `packages/compliance/legal/*.md` per locale.
- **Retention** (`data-retention-export-matrix.md`): QStash jobs `retention-sweep` (daily):
  AI drafts 90d unpublished, session documents per policy, reservations 24h,
  notification deliveries 1y. **Member account deletion (Phase 5 request, finalised here)**
  after the grace period: (a) `shredOrgKeys(personalSpaceOrgId)` + delete the member's own rows
  (profile, preferences, consents, CRM contact rows that reference the user); (b) `session_documents`
  uploaded by the member (`uploaded_by = member`) or with scope `shared` uploaded for them:
  delete the private Blob object **and** the row; (c) expert-authored `records` about the member
  (encrypted under the _expert_ org key, so the member-key shred does not cover them) fall under
  the **legal clinical-record retention exception** in `data-retention-export-matrix.md`: keep
  them for the statutory period, replace `member_user_id` with a tombstone id (`deleted_users`
  row holding only a salted hash), strip member identity from `metadata_encrypted`, and hard-delete
  when the retention period ends via the sweep — the exception, its period and the legal basis are
  written into the matrix and the DPIA in this phase; DSAR collectors for records (decrypt only
  the member's published records + documents they own).
- **Expert UI** (`apps/expert`): member list (`/[orgSlug]/members` — from bookings), member
  detail (sessions timeline, notes, documents, reports), session notes editor (in the Phase 9 call
  side panel and post-call) and report composer, both on `@eleva/editor` `RichTextEditor`
  (ADR-023; Plate JSON encrypted at rest, sanitized HTML derived server-side **after** decrypt for
  the member view — never stored in clear) with "Publish to member" (audited);
  **template library** (`/[orgSlug]/templates`): `record_templates` (per expert org, `kind`
  `note|report|consultation|message`, localized title, Plate JSON body with placeholders
  `{{member.firstName}}`, `{{session.date}}`, `{{expert.name}}`, tags, `is_default`, version) —
  "Start from template" in the notes editor and report composer, "Save as template" from any
  record, duplicate, archive; Eleva ships a starter set per specialty as seed data
  (`packages/db/src/seed/record-templates.ts`, `pt/en/es`); templates are **not** PHI (no member
  data allowed — the server-side save flow strips filled placeholders back to tokens, then runs a
  PHI scrubber over the remaining text — exact member identifiers from the source booking (name,
  e-mail, phone, date of birth, appointment date/time, location) plus pattern detectors for
  e-mails, phone numbers, dates, national ID/NIF formats and free-text clinical findings copied
  from the source record — and refuses the save with the offending spans highlighted; nothing is
  persisted until the scrubber passes; tests cover every detector class); document upload with `uploadBlobClient` from
  `@eleva/storage/blob-upload-client` in the browser and `handleBlobUpload` from
  `@eleva/storage/blob-upload-handler` in the `apps/api` Route Handler, to the **private** store
  with server-side authorization (never `@vercel/blob` directly).
- **Member UI** (`apps/app`): `/[orgSlug]/reports` list + detail (published records), document
  download via signed URLs (short-lived), consent management extended.
- **CRM** (`@eleva/crm`): `contacts` (per expert org, derived from members who booked + manual),
  `lifecycle_stage` (`lead|active|dormant|churned`), `follow_ups` (due_at, kind, note, done_at),
  tags; endpoints + expert UI (`/[orgSlug]/crm`), reminders via Lane 1 kind `crm.follow_up_due`.
- **AI reports beta** (`@eleva/ai`, Vercel AI Gateway only) — **from typed notes, not from
  recordings**: `draftSessionReport({ bookingId, noteRecordIds })` (one signature everywhere —
  Scope, prompt, tests, `@eleva/api-client`; `bookingId` authorizes: every note id must belong to
  that booking and to the caller's org, checked before any decryption) takes the expert's encrypted session
  notes (and, optionally, the intake answers the member typed at booking) as the only input, with
  versioned prompt contracts (`packages/ai/prompts/session-report.v1.ts`) and Zod-validated
  structured output -> `records.kind = ai_draft` (never auto-published) -> expert reviews, edits,
  publishes. PHI stays inside the request to the gateway with **zero data retention verified per
  model** (the `PHI_APPROVED_MODELS` allow-list below), prompts logged without content, model
  pinned via config. **Recording and transcription are not in this phase**: Daily's HIPAA
  recording requires a customer-owned S3 landing zone and its own consent kind; the whole
  recording -> transcript -> draft pipeline (including the `syncRoomRecording` fencing design
  written for it) lives in **Phase 16.8** and is gated on the storage decision D-08. Nothing in
  Phase 10 writes `sessions.recording_*` columns or calls Daily.
- **Encryption key controls (ADR-009 operations, P1)**: `packages/encryption` gains the operating
  rules this phase depends on — the KEK custody contract is the one Phase 1 / ADR-009 and Phase
  15 share: each KEK version is a Vercel **sensitive** environment variable `ELEVA_KEK_V<n>`
  (write-only — never readable back from the dashboard, CLI or `vercel env pull`), set from an
  offline escrow (vault entry under a two-person rule) and never in `.env*` files, logs, Sentry
  or CI; there is no separate KMS in the stack. DEKs are
  per organization and wrapped by the KEK version recorded on the row (`dek_kek_version`), KEK
  rotation is a documented job (`pnpm encryption:rotate-kek` re-wraps DEKs, never re-encrypts
  data; runbook + test with two KEK versions live at once), DEK rotation per org is available but
  not scheduled at launch, envelope helpers refuse to run when `ENCRYPTION_KEK_VERSION` does not
  match an unwrap-able key, and access to decrypt is audited (`record: decrypted` with viewer +
  purpose, sampled 100% for staff, 1% for the owning expert). Key custody (who can read the KEK,
  break-glass procedure, two-person rule) is written into `admin-operator-playbooks.md` and
  reviewed in Phase 13 — Phase 13 verifies, it does not introduce.
- **Clinical access model (D-11, working decision)**: expert-authored `records` are readable by
  the authoring expert, by other experts of the same clinic organization **only** when the clinic
  admin has enabled `clinic_shared_records` for that organization and the member has not opted
  out, and by Eleva staff **never** in plaintext (staff see metadata; break-glass decrypt is a
  Phase 12 dual-control action). The RLS policies below implement exactly this and the class tests
  cover all four viewers; Phase 11 (clinics) only toggles the flag, it does not add policies.
- Observability: PHI never reaches logs or Sentry, enforced **structurally, not by field
  name**: (1) `decryptForOrg` returns a `Decrypted<T>` branded object whose `toJSON` and
  `[util.inspect.custom]` yield `"[redacted]"`, so accidental `logger.info({ record })` or
  `JSON.stringify` prints nothing; (2) the record/AI logger in `@eleva/records` accepts only an
  **allow-list** of scalar metadata (`recordId`, `kind`, `orgId`, `bookingId`, `status`,
  `modelId`, `tokenCount`, `durationMs`) — its TypeScript type rejects any other key and a unit
  test asserts unknown keys are dropped at runtime; (3) Sentry `beforeSend`/`beforeBreadcrumb`
  walk the **entire** event recursively (`message`, `exception.values[].value` and stack frame
  `vars`, `request` (url, query, headers, data, cookies), `user`, `tags`, `extra`, `contexts`,
  `breadcrumbs[].data/message`, transaction name, spans data) and redact any value that is a
  `Decrypted` marker or matches an AI output key (`summary`, `observations`, `recommendations`,
  or any key of the `draftSessionReport` output schema, derived from the Zod schema so new
  fields are covered automatically); (4) **free-form strings** are scrubbed too, not only
  keyed fields: `decryptForOrg` and the AI draft step register every plaintext they produce in
  a request-scoped PHI registry (`AsyncLocalStorage`; values are kept as the first 64 chars
  plus a SHA-256 of the whole, never stored elsewhere) and `redactString` replaces any
  occurrence of a registered value (exact or prefix match) with `[phi]` in every string the
  walk visits — `Error.message`, breadcrumb messages, request bodies, tags, span data — in
  addition to the pattern scrubbers (e-mail, phone, NIF, token shapes); in workers without a
  request scope the registry is job-scoped. Unknown top-level fields are dropped (explicit
  allow-list of Sentry event keys), so a new SDK field can never smuggle payloads. Object-level
  tests feed
  a full decrypted record and a full AI draft through logger and Sentry via **each** of those
  locations (a thrown Error whose message embeds the record, a breadcrumb, request data, a tag,
  a span attribute) and assert zero PHI substrings in the output. Because `Decrypted<T>` serializes to `"[redacted]"`, API
  responses **never return it directly**: every authorized read maps it through an explicit
  response DTO (`toRecordResponse(decrypted, viewer)` in `@eleva/records`, plain object, Zod
  response schema registered in OpenAPI) that copies exactly the fields the viewer may see; the
  two serialization paths are tested separately (DTO -> full authorized content; logger/Sentry ->
  redacted) and an ESLint rule forbids `NextResponse.json` with a `Decrypted` argument.

Out: group sessions, member-authored records, AI for anything beyond session reports.

## Deliverables

1. Migrations: `records`, `session_documents`, `crm_contacts`, `crm_follow_ups`, consent kinds,
   retention bookkeeping; RLS incl. member-read policy; audit unions (`record:
created|updated|published|unpublished|deleted`; `document: uploaded|deleted`; `consent: ...`;
   `crm_contact`, `follow_up`; `ai_draft: requested|generated|failed`).
2. `@eleva/compliance` retention jobs + DSAR record collector + legal texts; QStash schedule.
3. `@eleva/crm`, `@eleva/ai` implementations + tests (gateway mocked).
4. `packages/encryption` key controls: `dek_kek_version`, KEK keyring, `pnpm encryption:rotate-kek`,
   decrypt audit; clinical access model RLS (D-11) with class tests.
5. API routes: `/records`, `/records/[id]`, `/records/[id]/publish`, `/documents/upload-token`,
   `/documents/[id]/url`, `/crm/contacts`, `/crm/follow-ups`, `/ai/session-report`
   - OpenAPI + client.
6. Expert + member UI with `pt/en/es` messages; flag `ff.ai_reports_beta`.
7. Template library: `record_templates` migration (RLS, audit `record_template:
created|updated|archived`), API `/records/templates` CRUD + `POST /records/templates/[id]/apply`
   (server-side placeholder fill, returns Plate JSON), starter seed, UI, tests (placeholder fill,
   PHI-refusal on save).

## Acceptance criteria

- [ ] Record body at rest is ciphertext (`v1:` prefix); reading via API returns plaintext only to
      authorized roles; member sees only published records.
- [ ] Documents live in the private Blob store; direct URL without signature 403; signed URL
      expires (<= 15 min).
- [ ] `pnpm encryption:rotate-kek` re-wraps every DEK with two KEK versions live; ciphertext
      unchanged; decrypt works before, during and after; `record: decrypted` audit rows present.
- [ ] Clinical access matrix: authoring expert reads; clinic colleague reads only with
      `clinic_shared_records` on and no member opt-out; staff never see `body_encrypted`.
- [ ] No `@daily-co/*`, `sessions.recording_*` or `transcript` kind touched in this phase (grep
      check in the PR body).
- [ ] Retention sweep deletes an expired unpublished AI draft in a
      seeded test; account deletion after grace period shreds keys and rows; DSAR includes published
      records and owned documents.
- [ ] AI draft generated from fixture typed notes through the AI Gateway (mock in tests, real on
      staging) validates against the Zod schema; publishing requires expert action; audit trail
      complete.
- [ ] Sentry test event with a record payload arrives redacted.
- [ ] CRM follow-up due -> notification kind `crm.follow_up_due` delivered.

## Tests

- vitest: RLS member-read policy, encryption at rest, signed URL expiry, retention selection
  queries, AI output schema validation + prompt contract snapshot, CRM lifecycle transitions.
- Playwright: expert writes note -> publishes report -> member reads it.

## Docs to update

- `ai-reporting-spec.md`, `crm-spec.md`, `compliance-data-governance.md`,
  `data-retention-export-matrix.md`, `feature-flag-rollout-plan.md`, `ops-observability-spec.md`
  (redaction), `decision-log.md`.

## Local references

- ADR-009, ADR-020, ADR-023, `docs/eleva-v3/{ai-reporting-spec,crm-spec,compliance-data-governance,data-retention-export-matrix}.md`.
- `packages/editor/src/**` and `packages/ai/src/{approved-models,editor-assist}.ts` (Phase 4B).
- `packages/encryption/src/*` (Phase 3), `packages/storage/src/**`, `.cursor/rules/blob-storage.mdc`,
  `packages/compliance/src/**` (Phase 5), `packages/video/src/**` (Phase 9), `packages/flags/src/**`,
  `packages/observability/src/**`.
- MVP records: `_context/clone-repo/eleva-care-app/drizzle/schema.ts` (`RecordsTable`),
  `_context/clone-repo/eleva-care-app/src/server/actions/records*` if present.

## External docs

- Vercel AI SDK + AI Gateway `/vercel/ai` (structured output with Zod, provider options,
  gateway model ids, zero-data-retention provider options);
  Vercel Blob private store `/vercel/storage`; Sentry `beforeSend` `/getsentry/sentry-javascript`.

## Risks

- AI draft quality in `pt-PT` from terse notes: pin a model validated on staging; keep human
  review mandatory; never auto-publish.
- KEK custody: a lost or leaked KEK is unrecoverable/catastrophic — the keyring + rotation job
  and the two-person rule exist so the response is "rotate", not "rebuild".

## Copy-paste prompt

```text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(the directory containing pnpm-workspace.yaml). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (encryption, blob-storage, daily-video, api-first-agentic,
   audit-wiring) and .cursor/skills/{api-first-agentic,audit-wiring,coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/10-records-crm-ai.md in full.
3. Read every file under "Local references". Pull Vercel AI SDK/AI Gateway (generateObject with
   Zod, gateway provider, zero-retention provider options), Vercel Blob private store and Sentry
   beforeSend docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 10 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-10.1/records-consent-retention
- Second PR (opened after the first merges): phase-10.2/crm-ai-reports. Each PR: <= 30 files / 400 lines where possible; split above 60 / 800 and always before 100 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
  or the review cap is reached (README section 4 rule 4: max 3 rounds, zero Critical/Major left,
  remaining Minor/Trivial listed in the PR body "Deferred findings" table with a reason each).
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean or
  the cap (max 2 rounds, same exit rule).
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green
  (after 2 App rounds escalate leftovers to the reviewer — README section 4 rule 6); request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for every app's required locales (pt/en/es; apps/admin
pt/en only — decision-log staff-only exception), cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 10 TASK — Encrypted records, consent, retention, CRM and AI report drafting (ADR-009, ADR-020).

PR 10.1 — records, documents, consent, retention:
1. packages/db: records (id, expert_org_id, member_user_id, booking_id nullable, kind from the
   shared RECORD_KINDS const = note|report|document_ref|ai_draft (transcript joins in 16.8; single enum reused by
   the pg enum, Zod schemas, audit unions and tests), title_encrypted, body_encrypted (text, envelope ciphertext), format
   markdown|json, version int, published_at nullable, created_by, created_at, updated_at,
   deleted_at), session_documents (id, expert_org_id, member_user_id, booking_id nullable,
   blob_pathname unique, mime, size_bytes, metadata_encrypted, scope expert_only|shared,
   uploaded_by, created_at, deleted_at). RLS, per table: records — policy A (expert-side, D-11):
   expert_org_id = eleva.org_id AND (created_by = eleva.user_id OR (the org's
   clinic_shared_records is true AND no record_access_optouts row for (member_user_id,
   expert_org_id))) — never "whole org"; INSERT/UPDATE only where created_by = eleva.user_id;
   policy B member read where member_user_id = current_setting('eleva.user_id')
   AND published_at IS NOT NULL AND deleted_at IS NULL. session_documents has no published_at;
   its visibility field is scope — the SAME policy A (uploaded_by as author); policy B member read
   where member_user_id = current_setting('eleva.user_id') AND scope = 'shared' AND deleted_at IS
   NULL (documents the member uploaded are always scope = 'shared'; expert_only documents are
   never visible to the member). Add withUserContext(userId, fn) in @eleva/db that sets
   eleva.user_id; RLS tests cover: unpublished record hidden, published record visible,
   expert_only document hidden, shared document visible, other member's rows hidden.
   Consent kinds: append ai_processing to CONSENT_KINDS in @eleva/compliance
   (health_data_processing exists since Phase 4, marketing since Phase 5; session_recording is
   Phase 16.8's) and regenerate the pg enum;
   versioned texts in
   packages/compliance/legal/<kind>.<locale>.md. Audit unions per phase file.
2. apps/api: GET/POST /records (expert), GET/PATCH/DELETE /records/[id], POST /records/[id]/
   publish|unpublish, GET /me/records (member, published only), POST /documents/upload-token
   (server-authorized token for the PRIVATE Blob store via handleBlobUpload from
   @eleva/storage/blob-upload-handler with pathname prefix records/<expertOrgId>/<memberUserId>/), POST /documents/complete, GET
   /documents/[id]/url (signed URL <= 15 min, audited), DELETE /documents/[id], GET/PUT
   /me/consents extended. All bodies encrypted with encryptForOrg(expertOrgId) before insert;
   decrypt only after authorization. OpenAPI + client.
3. @eleva/compliance: retention jobs (packages/compliance/src/retention.ts: policies from
   data-retention-export-matrix.md — unpublished ai_draft 90d, session_documents
   per matrix, slot reservations 24h, notification_deliveries 1y) run by POST /workflows/
   retention-sweep daily 03:00 Lisbon (infra/qstash/setup-compliance.ts + root script). Every
   session_documents expiry deletes the PRIVATE Blob object first through @eleva/storage
   (deleteBlob(pathname), idempotent: a 404 from the store counts as deleted) and only then the
   row, in that order, so a crash never leaves an orphaned PHI object; a failed object deletion
   leaves the row with retention_error + attempts for the next sweep and alerts after 3 failures;
   test: expired document -> store mock receives one delete, row gone; store failure -> row kept
   and flagged; second sweep after store recovery -> both gone. Finalize
   account deletion: after grace period -> shredOrgKeys(personal space) + delete the member's rows
   + delete member-uploaded/shared session_documents (Blob object AND row, via @eleva/storage) +
   tombstone member_user_id on expert-authored records (deleted_users salted-hash row; strip
   identity from metadata_encrypted) which stay under the clinical-record retention exception
   until the sweep hard-deletes them at the end of the statutory period (document period + legal
   basis in data-retention-export-matrix.md and the DPIA) + audit;
   DSAR collector for records/documents (member's published records decrypted, owned documents
   listed with fresh signed URLs). Tests with seeded expired rows.
4. apps/expert: /[orgSlug]/members (list from bookings, search), /[orgSlug]/members/[userId]
   (timeline of sessions, notes, documents, reports), notes editor in the Phase 9 call side panel
   and post-call page (autosave encrypted drafts) and report composer, both using @eleva/editor
   RichTextEditor with ai.context = "clinical" (ADR-023; Plate JSON is the encrypted payload —
   body_encrypted (the field defined in deliverable 1) holds the JSON, the sanitized HTML for the member view is derived server-side
   after decrypt on read, never persisted in clear; toPlainText feeds nothing outside the
   encrypted row) with Publish (confirmation dialog; audited), document upload (private store,
   browser side uses uploadBlobClient from @eleva/storage/blob-upload-client).
   Template library: packages/db record_templates (id, org_id, kind note|report|consultation|
   message, title jsonb, body_json jsonb Plate value with {{member.firstName}}, {{session.date}},
   {{expert.name}} placeholders, tags text[], is_default, version, archived_at; RLS by org; audit
   record_template: created|updated|archived), starter seed packages/db/src/seed/record-templates.ts
   (pt/en/es, per specialty); API /records/templates CRUD + POST /records/templates/[id]/apply
   ({ bookingId }) -> server fills placeholders and returns Plate JSON for the editor; UI
   /[orgSlug]/templates (gallery with kind filter, preview, duplicate, archive), "Start from
   template" in notes/report composers, "Save as template" from any record (server-side: strips
   filled placeholders back to tokens, then a PHI scrubber rejects the save when the remaining
   text contains any identifier of the source booking's member — name, e-mail, phone, date of
   birth, appointment date/time, location — or matches pattern detectors for e-mails, phones,
   dates, NIF/national IDs or clinical sentences copied verbatim from the source record; the UI
   highlights the offending spans; nothing persists until it passes — templates must never carry
   PHI). Tests: placeholder fill, PHI refusal for each detector class (non-name PHI included),
   tokenised templates still save, RLS.
   apps/app: /[orgSlug]/reports (published records) and /[orgSlug]/reports/[id], documents with
   signed download, consent banner on the join page for ai_processing.
   Messages pt/en/es; "members" wording.
5. Observability (structural, not field-name based): decryptForOrg returns Decrypted<T> whose
   toJSON and util.inspect.custom yield "[redacted]"; @eleva/records exports recordLogger whose
   payload type is an allow-list of scalar metadata only (recordId, kind, orgId, bookingId,
   status, modelId, tokenCount, durationMs) and drops unknown keys at runtime; Sentry
   beforeSend/beforeBreadcrumb drop events carrying a Decrypted marker or any key of the
   draftSessionReport Zod output schema (derive the key list from the schema — never hand-write
   it) plus body, body_encrypted, transcript, notes, title, AND redact free-form strings:
   decryptForOrg and the AI draft step register every produced plaintext in a request-scoped
   (AsyncLocalStorage; job-scoped in workers) PHI registry and redactString replaces any
   registered value found in Error.message, breadcrumb messages, request data, tags or span
   data with "[phi]" on top of the e-mail/phone/NIF/token pattern scrubbers. Object-level
   tests: log a full decrypted record and a full AI draft through the logger and through
   Sentry's beforeSend via EACH location (thrown Error whose message embeds the record,
   breadcrumb, request data, tag, span attribute), assert
   the output contains none of the fixture's PHI strings. API responses never serialize a
   Decrypted<T> (it would print "[redacted]" to an authorized viewer): add
   toRecordResponse(decrypted, viewer) in @eleva/records returning a plain DTO validated by a Zod
   response schema registered in OpenAPI, use it in every record/report route, add an ESLint rule
   in packages/eslint-config that forbids passing a Decrypted value to NextResponse.json, and test
   both paths separately (DTO carries the full authorized body; logger/Sentry output is
   redacted); docs ops-observability-spec.md.

PR 10.2 — CRM + AI reports beta:
6. @eleva/crm + packages/db: crm_contacts (id, expert_org_id, member_user_id nullable, name,
   email_encrypted, phone_encrypted, lifecycle_stage lead|active|dormant|churned, tags text[],
   last_session_at, created_at), crm_follow_ups (id, contact_id, due_at, kind call|message|
   review, note_encrypted, done_at, created_by). Auto-create/update contacts from booking events
   (emitDomainEvent). Endpoints GET/POST /crm/contacts, PATCH /crm/contacts/[id], GET/POST
   /crm/follow-ups, POST /crm/follow-ups/[id]/done; daily job flags due follow-ups -> Lane 1 kind
   crm.follow_up_due. apps/expert /[orgSlug]/crm (table with stage filter, contact drawer,
   follow-up list). RLS + audit.
7. Encryption key controls (ADR-009 operations): in packages/encryption add dek_kek_version to
   every wrapped-DEK row, ENCRYPTION_KEK_VERSION + a keyring of unwrap-able KEK versions read
   from Vercel SENSITIVE environment variables ELEVA_KEK_V<n> (the custody contract in Scope,
   ADR-009 and the Phase 15 launch gate — write-only in the dashboard, set from offline escrow
   under the two-person rule, never in .env files, previews or CI; there is NO separate KMS or
   secret manager in the stack, and security-hardening-checklist.md must say the same — fix it if
   it still names one; document the break-glass path), pnpm encryption:rotate-kek
   (re-wraps every DEK under the current version in batches, idempotent, never touches
   ciphertext; test with two KEK versions live), refuse to start when the configured version is
   not unwrap-able, and audit record: decrypted (viewer, purpose) on every decryptForOrg call
   (100% for staff sessions, 1% sampled for the owning expert). Runbook in
   integration-runbooks.md + admin-operator-playbooks.md (custody, two-person rule).
   Clinical access model (D-11) — this IS policy A above, stated once: read for the authoring
   expert; for other experts of the same clinic org only when organizations.clinic_shared_records
   is true AND no record_access_optouts row exists for (member_user_id, org_id); staff never read
   body_encrypted (column-level policy: staff role sees metadata columns only). Class tests for
   all four viewers. No recording, transcription, sessions.recording_* columns or Daily calls in
   this phase — that pipeline is Phase 16.8 (see that file for the fencing design already
   written for it).
8. @eleva/ai (only AI Gateway; no direct provider SDKs): packages/ai/src/prompts/session-report.
   v1.ts (system + user template; language from booking locale; output schema Zod { summary,
   observations[], recommendations[], followUpQuestions[], redFlags[] , disclaimer }), draftSession
   Report({ bookingId, noteRecordIds }) (the one signature — validate that every note belongs to
   bookingId and the caller's org BEFORE decrypting; mismatch -> 403, no decryption) — input is
   the expert's decrypted typed notes for that
   booking (plus the member's typed intake answers when present), never a transcript — using
   generateObject via the gateway with model id from
   AI_GATEWAY_MODEL_SESSION_REPORT (pinned) and fail closed on data retention: EXTEND the
   allow-list packages/ai/src/approved-models.ts introduced in Phase 4B so that every entry used
   for PHI-bearing calls (session reports, the editor's "clinical" context — enable it here by
   lifting the Phase 4B rejection) has { zeroRetention: true, evidenceUrl } verified against the
   provider's zero-data-retention terms through the AI Gateway (record the evidence in
   compliance-data-governance.md); draftSessionReport refuses to run
   (typed error AI_MODEL_NOT_APPROVED, audited) when the configured model is not on the list or
   the gateway response does not confirm the no-retention providerOptions were applied — never
   send PHI "where supported"; tokens/latency logged without content; result stored as records.kind = ai_draft
   (encrypted, unpublished) + audit ai_draft.generated; failures audited. Endpoint POST
   /ai/session-report { bookingId, noteRecordIds } (expert only, flag ff.ai_reports_beta, rate limited
   5/h/org) and GET status. Expert UI: "Draft with AI" on the session page -> draft appears in
   the report composer for editing -> Publish. Never auto-publish.
9. Flags in packages/flags: ff.ai_reports_beta (default off; on for staging
   pilot org). Env: AI_GATEWAY_API_KEY (or Vercel OIDC), AI_GATEWAY_MODEL_SESSION_REPORT.
10. Tests: encryption at rest, RLS A/B, signed URL expiry, retention selection, deletion finalize,
    KEK rotation with two live versions, clinical access matrix (4 viewers), AI schema
    validation with fixture typed notes (gateway mocked), prompt contract snapshot,
    CRM transitions. Playwright: expert note -> publish -> member reads.
11. Docs: ai-reporting-spec.md, crm-spec.md, compliance-data-governance.md,
    data-retention-export-matrix.md, feature-flag-rollout-plan.md, ops-observability-spec.md,
    decision-log.md.

Acceptance (paste evidence): ciphertext at rest; member sees only published; private documents
with expiring signed URLs; KEK rotation proof; clinical access matrix; retention + deletion
finalize + DSAR tests; AI draft from fixture notes validates and requires expert publish; Sentry
redaction; CRM
follow-up notification.

Report: migrations, endpoints, flags, tests, CodeRabbit CLI counts, PR URLs, deferred items.
```
