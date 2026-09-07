# Phase 10 — Records/PHI, CRM, AI reports beta

| Field      | Value                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-10/records-crm-ai` (split: `phase-10.1/records-consent-retention`, `phase-10.2/crm-ai-reports`)                                                                                                                                                                                                                                                                                                                     |
| Depends on | Phase 9                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Effort     | 2 weeks                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Touches    | `packages/db/src/schema/main/{records,session-documents,expert-notes,consents,crm}.ts`, `packages/encryption` (usage), `packages/storage` (private store), `packages/compliance/**` (retention jobs, DSAR collectors), `packages/crm/**`, `packages/ai/**`, `packages/video` (recording/transcript behind flag), `apps/api/src/app/{records,notes,crm,ai,workflows}/**`, `apps/expert/**`, `apps/app/**`, `packages/flags` |
| Exit gate  | Expert writes encrypted notes during/after a session, uploads documents to the private store, publishes a report the member can read via the app; retention jobs purge on schedule; consent captured; AI draft (behind `ff.ai_reports_beta`) from a transcript reviewed and published by the expert; no PHI in Sentry/logs                                                                                                 |

## Why this phase exists

Clinical value and trust: encrypted records, member-visible reports, consent and retention are
core to ERS/GDPR/HIPAA posture. CRM gives experts follow-up tools. AI drafting is the first
differentiator and must ship behind a flag with strict PHI boundaries (ADR-009).

## Scope

In:

- **Records** (`records`: id, expert_org_id, member_user_id, booking_id nullable, kind
  `note|report|document_ref|transcript|ai_draft` (one shared `RECORD_KINDS` const in
  `packages/db/src/schema/main/records.ts`, reused by the migration enum, API Zod schemas,
  `@eleva/audit` unions and tests), `title_encrypted` + `body_encrypted` (envelope,
  `encryptForOrg(expertOrgId)`; naming convention `<field>_encrypted` everywhere),
  `published_at` (member-visible when set), `version`, `created_by`, timestamps;
  `session_documents`: private Blob pathname, mime, size, `metadata_encrypted`, uploaded_by,
  scope `expert_only|shared`). RLS — two different member-read predicates because the tables
  have different visibility columns: `records`: expert org full; member reads only
  `published_at IS NOT NULL AND member_user_id = current_setting('eleva.user_id')`.
  `session_documents`: expert org full; member reads only `scope = 'shared'` rows of bookings
  where they are the member (`session_documents` has **no** `published_at`). Both member
  policies use the `eleva.user_id` setting.
- **Consent**: `consents` kinds extended (`health_data_processing`, `session_recording`,
  `ai_processing`) captured at booking (Phase 4 form) and at session start (join page banner);
  versioned legal texts in `packages/compliance/legal/*.md` per locale.
- **Retention** (`data-retention-export-matrix.md`): QStash jobs `retention-sweep` (daily):
  transcripts 2y, AI drafts 90d unpublished, session documents per policy, reservations 24h,
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
  side panel and post-call), report composer (rich text -> sanitized HTML/Markdown) with
  "Publish to member" (audited); document upload with `uploadBlobClient` from
  `@eleva/storage/blob-upload-client` in the browser and `handleBlobUpload` from
  `@eleva/storage/blob-upload-handler` in the `apps/api` Route Handler, to the **private** store
  with server-side authorization (never `@vercel/blob` directly).
- **Member UI** (`apps/app`): `/[orgSlug]/reports` list + detail (published records), document
  download via signed URLs (short-lived), consent management extended.
- **CRM** (`@eleva/crm`): `contacts` (per expert org, derived from members who booked + manual),
  `lifecycle_stage` (`lead|active|dormant|churned`), `follow_ups` (due_at, kind, note, done_at),
  tags; endpoints + expert UI (`/[orgSlug]/crm`), reminders via Lane 1 kind `crm.follow_up_due`.
- **AI reports beta** (`@eleva/ai`, Vercel AI Gateway only): recording + transcription in
  `@eleva/video` behind `ff.session_recording` and both consents (expert + member). Phase 9
  creates the room at booking confirmation with `enable_recording: false`, and consent is
  captured on the join page, so recording is enabled by an **idempotent room update**, not at
  creation: `syncRoomRecording(bookingId)` in `@eleva/video` reads the flag + both consents and
  calls Daily `updateRoom(name, { properties: { enable_recording } })` only when the desired
  value differs from `sessions.recording_enabled`; it runs on every consent change and again in
  the `join` route before the token is minted, so the state is correct whenever anyone enters
  — a room is never re-created and a withdrawn consent flips it back to `false` the same way.
  Daily `enable_recording: "cloud"` + transcription webhook `transcript.ready`/`recording.ready-to-download`
  -> fetch -> store encrypted (`records.kind = transcript`) -> `draftSessionReport(transcriptId)`
  with versioned prompt contracts (`packages/ai/prompts/session-report.v1.ts`) and Zod-validated
  structured output -> `records.kind = ai_draft` (never auto-published) -> expert reviews, edits,
  publishes. PHI stays inside the request to the gateway with data-retention off (verify provider
  settings), prompts logged without content, model pinned via config.
- Observability: PHI never reaches logs or Sentry, enforced **structurally, not by field
  name**: (1) `decryptForOrg` returns a `Decrypted<T>` branded object whose `toJSON` and
  `[util.inspect.custom]` yield `"[redacted]"`, so accidental `logger.info({ record })` or
  `JSON.stringify` prints nothing; (2) the record/AI logger in `@eleva/records` accepts only an
  **allow-list** of scalar metadata (`recordId`, `kind`, `orgId`, `bookingId`, `status`,
  `modelId`, `tokenCount`, `durationMs`) — its TypeScript type rejects any other key and a unit
  test asserts unknown keys are dropped at runtime; (3) Sentry `beforeSend`/`beforeBreadcrumb`
  drop any event whose `extra`/`contexts` contain a `Decrypted` marker or an AI output object
  (`summary`, `observations`, `recommendations`, or any key of the `draftSessionReport` output
  schema, derived from the Zod schema so new fields are covered automatically). Object-level
  tests feed a full decrypted record and a full AI draft through logger and Sentry and assert
  zero PHI substrings in the output. Because `Decrypted<T>` serializes to `"[redacted]"`, API
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
4. `@eleva/video` recording/transcript support behind flags + webhook handlers.
5. API routes: `/records`, `/records/[id]`, `/records/[id]/publish`, `/documents/upload-token`,
   `/documents/[id]/url`, `/crm/contacts`, `/crm/follow-ups`, `/ai/session-report/[transcriptId]`
   - OpenAPI + client.
6. Expert + member UI with `pt/en/es` messages; flags `ff.session_recording`, `ff.ai_reports_beta`.

## Acceptance criteria

- [ ] Record body at rest is ciphertext (`v1:` prefix); reading via API returns plaintext only to
      authorized roles; member sees only published records.
- [ ] Documents live in the private Blob store; direct URL without signature 403; signed URL
      expires (<= 15 min).
- [ ] Consent required to record: without both consents `enable_recording` stays false and the UI
      hides the record button; both consents given after the room exists -> `syncRoomRecording`
      updates the existing room (idempotent, asserted via a mocked Daily `updateRoom` called once);
      a withdrawn consent flips it back.
- [ ] Retention sweep deletes an expired unpublished AI draft and an expired transcript in a
      seeded test; account deletion after grace period shreds keys and rows; DSAR includes published
      records and owned documents.
- [ ] AI draft generated from a fixture transcript through the AI Gateway (mock in tests, real on
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

- ADR-009, ADR-020, `docs/eleva-v3/{ai-reporting-spec,crm-spec,compliance-data-governance,data-retention-export-matrix}.md`.
- `packages/encryption/src/*` (Phase 3), `packages/storage/src/**`, `.cursor/rules/blob-storage.mdc`,
  `packages/compliance/src/**` (Phase 5), `packages/video/src/**` (Phase 9), `packages/flags/src/**`,
  `packages/observability/src/**`.
- MVP records: `_context/clone-repo/eleva-care-app/drizzle/schema.ts` (`RecordsTable`),
  `_context/clone-repo/eleva-care-app/src/server/actions/records*` if present.

## External docs

- Vercel AI SDK + AI Gateway `/vercel/ai` (structured output with Zod, provider options,
  gateway model ids); Daily recording + transcription `/websites/daily_co_reference_rest-api`;
  Vercel Blob private store `/vercel/storage`; Sentry `beforeSend` `/getsentry/sentry-javascript`.

## Risks

- Transcript accuracy in `pt-PT`: pin a model/provider validated on staging; keep human review
  mandatory.
- Storage of recordings: keep in Daily's storage only until transcript is ready, then delete
  (unless `ff.session_recording_keep` later).

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
   Zod, gateway provider), Daily recording/transcription, Vercel Blob private store and Sentry
   beforeSend docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory) — this is the outer loop; the "PHASE 10 TASK" section further down is
what you implement at the "Implement the deliverables" step. Read the whole prompt before the
first command; run the checks and both review loops only AFTER the task work exists:
- git checkout main && git pull --ff-only && git checkout -b phase-10.1/records-consent-retention
  (second PR: phase-10.2/crm-ai-reports). Each under 150 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean.
- git push -u origin HEAD && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green; request
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
   shared RECORD_KINDS const = note|report|document_ref|transcript|ai_draft (single enum reused by
   the pg enum, Zod schemas, audit unions and tests), title_encrypted, body_encrypted (text, envelope ciphertext), format
   markdown|json, version int, published_at nullable, created_by, created_at, updated_at,
   deleted_at), session_documents (id, expert_org_id, member_user_id, booking_id nullable,
   blob_pathname unique, mime, size_bytes, metadata_encrypted, scope expert_only|shared,
   uploaded_by, created_at, deleted_at). RLS, per table: records — policy A expert org via
   eleva.org_id; policy B member read where member_user_id = current_setting('eleva.user_id')
   AND published_at IS NOT NULL AND deleted_at IS NULL. session_documents has no published_at;
   its visibility field is scope — policy A expert org via eleva.org_id; policy B member read
   where member_user_id = current_setting('eleva.user_id') AND scope = 'shared' AND deleted_at IS
   NULL (documents the member uploaded are always scope = 'shared'; expert_only documents are
   never visible to the member). Add withUserContext(userId, fn) in @eleva/db that sets
   eleva.user_id; RLS tests cover: unpublished record hidden, published record visible,
   expert_only document hidden, shared document visible, other member's rows hidden.
   Consent kinds: append session_recording and ai_processing to CONSENT_KINDS in
   @eleva/compliance (health_data_processing exists since Phase 5) and regenerate the pg enum;
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
   data-retention-export-matrix.md — transcripts 2y, unpublished ai_draft 90d, session_documents
   per matrix, slot reservations 24h, notification_deliveries 1y) run by POST /workflows/
   retention-sweep daily 03:00 Lisbon (infra/qstash/setup-compliance.ts + root script); finalize
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
   and post-call page (autosave encrypted drafts), report composer (Markdown editor with preview,
   sanitized) with Publish (confirmation dialog; audited), document upload (private store, browser
   side uses uploadBlobClient from @eleva/storage/blob-upload-client).
   apps/app: /[orgSlug]/reports (published records) and /[orgSlug]/reports/[id], documents with
   signed download, consent banner on the join page for session_recording + ai_processing.
   Messages pt/en/es; "members" wording.
5. Observability (structural, not field-name based): decryptForOrg returns Decrypted<T> whose
   toJSON and util.inspect.custom yield "[redacted]"; @eleva/records exports recordLogger whose
   payload type is an allow-list of scalar metadata only (recordId, kind, orgId, bookingId,
   status, modelId, tokenCount, durationMs) and drops unknown keys at runtime; Sentry
   beforeSend/beforeBreadcrumb drop events carrying a Decrypted marker or any key of the
   draftSessionReport Zod output schema (derive the key list from the schema — never hand-write
   it) plus body, body_encrypted, transcript, notes, title. Object-level tests: log a full
   decrypted record and a full AI draft through the logger and through Sentry's beforeSend, assert
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
7. Recording/transcription behind flags: Phase 9 rooms are created at confirmation with
   enable_recording false and consent arrives later on the join page, so add
   syncRoomRecording(bookingId) to @eleva/video: desired = ff.session_recording on AND both
   consents (expert + member) granted; if desired !== sessions.recording_enabled call Daily
   updateRoom(name, { properties: { enable_recording: desired ? "cloud" : false } }) and persist
   the new value (idempotent — no call when unchanged); invoke it from the consent write path
   (PUT /me/consents, expert consent toggle) and from POST /sessions/[bookingId]/join before
   minting the token; createSessionRoom keeps { recording: false } at creation. Tests: consent
   after room creation -> exactly one updateRoom call; withdrawn consent -> flipped back; join with
   state already correct -> zero Daily calls. Handle webhooks recording.ready-to-download and transcript.ready (signature verified,
   idempotent) -> download transcript via Daily API -> store as records.kind = transcript
   (encrypted) -> delete the Daily recording after transcript stored (unless a keep flag) ->
   emitDomainEvent("transcript.ready").
8. @eleva/ai (only AI Gateway; no direct provider SDKs): packages/ai/src/prompts/session-report.
   v1.ts (system + user template; language from booking locale; output schema Zod { summary,
   observations[], recommendations[], followUpQuestions[], redFlags[] , disclaimer }), draftSession
   Report({ transcriptRecordId }) using generateObject via the gateway with model id from
   AI_GATEWAY_MODEL_SESSION_REPORT (pinned) and fail closed on data retention: keep an allow-list
   packages/ai/src/approved-models.ts of { modelId, provider, zeroRetention: true, evidenceUrl }
   entries verified against the provider's zero-data-retention terms through the AI Gateway
   (record the evidence in compliance-data-governance.md); draftSessionReport refuses to run
   (typed error AI_MODEL_NOT_APPROVED, audited) when the configured model is not on the list or
   the gateway response does not confirm the no-retention providerOptions were applied — never
   send PHI "where supported"; tokens/latency logged without content; result stored as records.kind = ai_draft
   (encrypted, unpublished) + audit ai_draft.generated; failures audited. Endpoint POST
   /ai/session-report/[transcriptRecordId] (expert only, flag ff.ai_reports_beta, rate limited
   5/h/org) and GET status. Expert UI: "Draft with AI" on the session page -> draft appears in
   the report composer for editing -> Publish. Never auto-publish.
9. Flags in packages/flags: ff.session_recording, ff.ai_reports_beta (default off; on for staging
   pilot org). Env: AI_GATEWAY_API_KEY (or Vercel OIDC), AI_GATEWAY_MODEL_SESSION_REPORT.
10. Tests: encryption at rest, RLS A/B, signed URL expiry, retention selection, deletion finalize,
    AI schema validation with a fixture transcript (gateway mocked), prompt contract snapshot,
    CRM transitions. Playwright: expert note -> publish -> member reads.
11. Docs: ai-reporting-spec.md, crm-spec.md, compliance-data-governance.md,
    data-retention-export-matrix.md, feature-flag-rollout-plan.md, ops-observability-spec.md,
    decision-log.md.

Acceptance (paste evidence): ciphertext at rest; member sees only published; private documents
with expiring signed URLs; consent gating for recording; retention + deletion finalize + DSAR
tests; AI draft from fixture validates and requires expert publish; Sentry redaction; CRM
follow-up notification.

Report: migrations, endpoints, flags, tests, CodeRabbit CLI counts, PR URLs, deferred items.
```
