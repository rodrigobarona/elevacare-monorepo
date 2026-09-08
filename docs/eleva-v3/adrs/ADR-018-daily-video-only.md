# ADR-018: Daily.co is the only video provider

## Status

Accepted

## Date

2026-09-07

## Context

The live MVP creates Google Meet links for online sessions. Meet is not a HIPAA-covered video
product Eleva can BAA, does not give Eleva a first-party room, meeting token or webhook surface,
and ties session join to a Google account. Daily.co is already the locked video vendor in the
handbook (`vendor-decision-matrix.md`) and in ADR-009 (transcripts as Eleva records). The
execution plan ([`execution-plan/README.md`](../execution-plan/README.md) section 2) freezes
Daily as the only video path so Phase 9 does not keep a Meet fallback.

Constraints: EU processing and a BAA/DPA (gate **D-07**); HIPAA-mode rooms cannot use custom
names or live streaming; session recordings, if ever offered, need a customer-owned S3 landing
zone that Daily can assume an IAM role into (gate **D-08**, backlog 16.8 — not Phase 9 or 10);
the join page lives on `eleva.care/[orgSlug]/sessions/...` (member) and
`eleva.care/[orgSlug]/expert/sessions/...` (expert) via gateway rewrites — not
`app.eleva.care`; the branded Daily domain is `sessions.eleva.care`
(Daily owns the CNAME). Phone and in-person delivery modes must keep working if Daily is down
or D-07 is unsigned.

## Decision

1. **Daily.co only.** Online sessions use `@eleva/video` (`packages/video`) talking to a
   HIPAA-enabled Daily domain (`elevacare.daily.co`) branded as `sessions.eleva.care`. Google
   Meet, Zoom and Microsoft Teams are not created, stored or linked. Google/Microsoft calendars
   remain busy-time and destination sync only (ADR-004 as amended by ADR-017).
2. **Room contract.** Private rooms, random names (HIPAA mode rejects custom names), `nbf`/`exp`
   around the booking window, `max_participants` derived from the booking. Meeting tokens are
   minted at join time per participant (expert `is_owner`); they are never stored, logged or
   placed in URLs.
3. **Authorization.** `session_participants` is the Eleva-side allow-list. Revoke is two-phase:
   set `revoked_at` (deny), then Daily `eject`, with a retry job if eject fails.
4. **Webhooks.** `meeting.started` / `meeting.ended` (and participant join/leave for history)
   update `sessions` with ordered processing (`last_event_at`, monotonic status). Recording and
   transcription webhooks are not handled until 16.8.
5. **Vendor boundary.** Only `packages/video` imports `@daily-co/*`. `apps/api` mounts
   `/webhooks/daily`. Frontends call `@eleva/api-client` to mint a token and then load Daily's
   client SDK on the join page.
6. **Fallback.** If D-07 is unsigned or Daily is unavailable, Phase 9 still ships join pages
   for phone and in-person modes; online mode stays unpublished.

## Alternatives Considered

### Keep Google Meet

- Pros: already in the MVP; experts know it.
- Cons: no BAA Eleva can rely on; no first-party room or token; join requires a Google account;
  no webhook lifecycle; recording lands in the expert's Drive.

### Zoom / Microsoft Teams

- Pros: clinician familiarity.
- Cons: same ownership and BAA problems; extra OAuth surface; not EU-first by default.

### Daily plus Meet fallback

- Pros: softer cutover.
- Cons: two code paths, two consent stories, two incident runbooks; Meet would still ship PHI
  outside Eleva's control. Rejected.

## Consequences

- Positive: one video vendor, one BAA, one webhook, one join UX; calendars stay calendars.
- Tradeoff: Eleva operates room lifecycle and token minting; Daily account pre-check is a
  spike (PR 09.0) before Phase 9 implementation.
- Operational: `DAILY_API_KEY`, `DAILY_DOMAIN`, `DAILY_WEBHOOK_SECRET` required; DNS CNAME
  `sessions.eleva.care` → Daily (Phase 15 C.0). Recording storage is explicitly **not** decided
  here — see D-08 / 16.8.
- Supersedes in part: ADR-004 (Google Meet as the online session destination).

## Related

- [`execution-plan/phases/09-video-daily.md`](../execution-plan/phases/09-video-daily.md),
  [`16-post-launch-backlog.md`](../execution-plan/phases/16-post-launch-backlog.md) item 16.8
- [ADR-009](ADR-009-ai-and-transcripts.md), [ADR-017](ADR-017-better-auth-identity.md)
- Daily REST (`/websites/daily_co_reference_rest-api`): rooms, meeting tokens, webhooks,
  HIPAA constraints, `recordings_bucket`
