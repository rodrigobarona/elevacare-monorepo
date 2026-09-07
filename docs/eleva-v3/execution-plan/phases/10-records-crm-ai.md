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
  scope `expert_only|shared`), RLS: expert org full; member reads only `published_at IS NOT NULL`
  rows for their own user id (second policy via `eleva.user_id` setting).
- **Consent**: `consents` kinds extended (`health_data_processing`, `session_recording`,
  `ai_processing`) captured at booking (Phase 4 form) and at session start (join page banner);
  versioned legal texts in `packages/compliance/legal/*.md` per locale.
- **Retention** (`data-retention-export-matrix.md`): QStash jobs `retention-sweep` (daily):
  transcripts 2y, AI drafts 90d unpublished, session documents per policy, reservations 24h,
  notification deliveries 1y; crypto-shred completes account deletion (Phase 5) after the grace
  period via `shredOrgKeys` for personal Spaces + row deletion; DSAR collectors for records
  (decrypt only the member's published records + documents they own).
- **Expert UI** (`apps/expert`): member list (`/[orgSlug]/members` — from bookings), member
  detail (sessions timeline, notes, documents, reports), session notes editor (in the Phase 9 call
  side panel and post-call), report composer (rich text -> sanitized HTML/Markdown) with
  "Publish to member" (audited); document upload via `@eleva/storage` `blob-upload-client` to the
  **private** store with server-side authorization.
- **Member UI** (`apps/app`): `/[orgSlug]/reports` list + detail (published records), document
  download via signed URLs (short-lived), consent management extended.
- **CRM** (`@eleva/crm`): `contacts` (per expert org, derived from members who booked + manual),
  `lifecycle_stage` (`lead|active|dormant|churned`), `follow_ups` (due_at, kind, note, done_at),
  tags; endpoints + expert UI (`/[orgSlug]/crm`), reminders via Lane 1 kind `crm.follow_up_due`.
- **AI reports beta** (`@eleva/ai`, Vercel AI Gateway only): recording + transcription in
  `@eleva/video` behind `ff.session_recording` and both consents (expert + member) — Daily
  `enable_recording: "cloud"` + transcription webhook `transcript.ready`/`recording.ready-to-download`
  -> fetch -> store encrypted (`records.kind = transcript`) -> `draftSessionReport(transcriptId)`
  with versioned prompt contracts (`packages/ai/prompts/session-report.v1.ts`) and Zod-validated
  structured output -> `records.kind = ai_draft` (never auto-published) -> expert reviews, edits,
  publishes. PHI stays inside the request to the gateway with data-retention off (verify provider
  settings), prompts logged without content, model pinned via config.
- Observability: Sentry `beforeSend` scrubbing of record bodies; structured logs never include
  decrypted content (lint rule/grep in CI for `decryptForOrg(` results being logged is not
  feasible — add code review checklist + unit test that the logger redacts keys `body`,
  `transcript`, `notes`).

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
      hides the record button.
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
(/Users/<you>/…/elevacare-monorepo). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc (encryption, blob-storage, daily-video, api-first-agentic,
   audit-wiring) and .cursor/skills/{api-first-agentic,audit-wiring,coderabbit-review}/SKILL.md.
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and
   docs/eleva-v3/execution-plan/phases/10-records-crm-ai.md in full.
3. Read every file under "Local references". Pull Vercel AI SDK/AI Gateway (generateObject with
   Zod, gateway provider), Daily recording/transcription, Vercel Blob private store and Sentry
   beforeSend docs through Context7
   (resolve-library-id then query-docs); prefer those docs over memory.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-10.1/records-consent-retention
  (second PR: phase-10.2/crm-ai-reports). Each under 150 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build &&
  pnpm check:i18n-parity
- Run: pnpm review -> fix -> repeat. Conventional Commits. pnpm review:branch -> fix.
- git push -u origin <branch> && gh pr create --base main (PR body template README section 8).
- Loop on CodeRabbit GitHub App comments + CI until zero unresolved and all green; request
  approval from @rodrigobarona; gh pr merge --squash --delete-branch.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for pt/en/es, cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 10 TASK — Encrypted records, consent, retention, CRM and AI report drafting (ADR-009, ADR-020).

PR 10.1 — records, documents, consent, retention:
1. packages/db: records (id, expert_org_id, member_user_id, booking_id nullable, kind from the
   shared RECORD_KINDS const = note|report|document_ref|transcript|ai_draft (single enum reused by
   the pg enum, Zod schemas, audit unions and tests), title_encrypted, body_encrypted (text, envelope ciphertext), format
   markdown|json, version int, published_at nullable, created_by, created_at, updated_at,
   deleted_at), session_documents (id, expert_org_id, member_user_id, booking_id nullable,
   blob_pathname unique, mime, size_bytes, metadata_encrypted, scope expert_only|shared,
   uploaded_by, created_at, deleted_at). RLS: policy A expert org via eleva.org_id; policy B member
   read where member_user_id = current_setting('eleva.user_id') and published_at is not null (add
   withUserContext(userId, fn) helper in @eleva/db that sets eleva.user_id, RLS tests for both).
   Consent kinds: health_data_processing, session_recording, ai_processing with versioned texts in
   packages/compliance/legal/<kind>.<locale>.md. Audit unions per phase file.
2. apps/api: GET/POST /records (expert), GET/PATCH/DELETE /records/[id], POST /records/[id]/
   publish|unpublish, GET /me/records (member, published only), POST /documents/upload-token
   (server-authorized token for the PRIVATE Blob store via @eleva/storage blob-upload-handler with
   pathname prefix records/<expertOrgId>/<memberUserId>/), POST /documents/complete, GET
   /documents/[id]/url (signed URL <= 15 min, audited), DELETE /documents/[id], GET/PUT
   /me/consents extended. All bodies encrypted with encryptForOrg(expertOrgId) before insert;
   decrypt only after authorization. OpenAPI + client.
3. @eleva/compliance: retention jobs (packages/compliance/src/retention.ts: policies from
   data-retention-export-matrix.md — transcripts 2y, unpublished ai_draft 90d, session_documents
   per matrix, slot reservations 24h, notification_deliveries 1y) run by POST /workflows/
   retention-sweep daily 03:00 Lisbon (infra/qstash/setup-compliance.ts + root script); finalize
   account deletion: after grace period -> shredOrgKeys(personal space) + delete rows + audit;
   DSAR collector for records/documents (member's published records decrypted, owned documents
   listed with fresh signed URLs). Tests with seeded expired rows.
4. apps/expert: /[orgSlug]/members (list from bookings, search), /[orgSlug]/members/[userId]
   (timeline of sessions, notes, documents, reports), notes editor in the Phase 9 call side panel
   and post-call page (autosave encrypted drafts), report composer (Markdown editor with preview,
   sanitized) with Publish (confirmation dialog; audited), document upload (private store).
   apps/app: /[orgSlug]/reports (published records) and /[orgSlug]/reports/[id], documents with
   signed download, consent banner on the join page for session_recording + ai_processing.
   Messages pt/en/es; "members" wording.
5. Observability: Sentry beforeSend/beforeBreadcrumb scrubbing keys body, body_encrypted,
   transcript, notes, title; logger redaction unit test; docs ops-observability-spec.md.

PR 10.2 — CRM + AI reports beta:
6. @eleva/crm + packages/db: crm_contacts (id, expert_org_id, member_user_id nullable, name,
   email_encrypted, phone_encrypted, lifecycle_stage lead|active|dormant|churned, tags text[],
   last_session_at, created_at), crm_follow_ups (id, contact_id, due_at, kind call|message|
   review, note_encrypted, done_at, created_by). Auto-create/update contacts from booking events
   (emitDomainEvent). Endpoints GET/POST /crm/contacts, PATCH /crm/contacts/[id], GET/POST
   /crm/follow-ups, POST /crm/follow-ups/[id]/done; daily job flags due follow-ups -> Lane 1 kind
   crm.follow_up_due. apps/expert /[orgSlug]/crm (table with stage filter, contact drawer,
   follow-up list). RLS + audit.
7. Recording/transcription behind flags: @eleva/video createSessionRoom accepts { recording:
   boolean } -> enable_recording "cloud" only when ff.session_recording is on AND both consents
   granted; handle webhooks recording.ready-to-download and transcript.ready (signature verified,
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
