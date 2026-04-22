# ADR-010: Mobile Diary Sync And Share Model

## Status

Accepted

## Date

2026-04-22

## Context

Eleva Diary is a patient-companion Expo/React Native app for symptom and health-tracking data capture, reminders, and consented data sharing with experts. It must join the Eleva monorepo so it uses the same identity, API contracts, and consent model — but it must not delay the core web foundation.

Patient-generated health data carries PHI sensitivity and GDPR obligations. The sync/share model must be designed, not improvised.

## Decision

- `apps/diary-mobile` joins the Eleva monorepo **after** `packages/auth`, `packages/db`, `apps/api`, and `packages/notifications` have shipped v1 contracts.
- `packages/mobile` holds mobile-safe client contracts (API SDKs, validation schemas, sync/share DTOs) shared with web.
- Diary data has three visibility states per entry (or per range):
  - **Private** (default) — only the patient sees it
  - **Synced to Eleva account** — available in the patient dashboard but not shared with experts
  - **Shared with a specific expert** — explicit consent grant, time-bounded, revocable, audited
- Sharing is **explicit per expert and per time range**, never blanket "all experts".
- Consent grants are first-class entities: `diary_share(patient_id, expert_id, start_date, end_date, granted_at, revoked_at, audit_ref)`.
- On share: Lane 1 `diary_share_visible_to_expert` notification fires to the expert; audit row written.
- On revoke: expert loses visibility immediately; audit row written.
- Diary data can feed AI report pipeline only when shared with that expert (ADR-009).
- Push notifications via Expo (tied to the same `packages/notifications` Lane 1 preferences + quiet hours).

## Alternatives Considered

### Option A — Separate backend for mobile

- Pros: decoupled release cycle
- Cons: schema drift, duplicated business rules, inconsistent privacy model — unacceptable for PHI

### Option B — Default "sync to expert" on account creation

- Pros: simpler UX
- Cons: violates consent-by-design; creates GDPR lawful-basis ambiguity

### Option C — Monorepo + explicit per-expert time-bounded sharing (chosen)

- Pros: clean consent model, auditable, patient-controlled, supports "share last 30 days for upcoming session" flow
- Cons: UX requires clear share/revoke affordances

## Consequences

- Patient UX: share control at the entry level and the range level; default private; clear "Stop sharing" button
- Expert UX: diary data appears in the session context only if a share is active for that expert at that time
- AI pipeline: respects the share window strictly; a report generated for session X only includes diary data visible to the expert at session-X time
- Mobile launches via `ff.diary_share` for staged rollout
- Expo push subscriptions stored encrypted; preferences honored via `notification_preferences`
- Audit rows written on every share/revoke and every time expert accesses shared diary data
