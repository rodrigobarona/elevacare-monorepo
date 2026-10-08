# Daily setup (operator)

Status: **standard domain, recording off, not HIPAA.** Founder 2026-10-07
deferred D-07 (no BAA). Do not enable HIPAA mode or `sessions.eleva.care`
until D-07 is signed. This file is the operator checklist for a working
Daily account — not a HIPAA claim.

## Account

1. Create a **standard** Daily domain (not HIPAA). Recording stays **off**.
2. Copy the domain hostname into `DAILY_DOMAIN` (`{subdomain}.daily.co`).
   Optional: `DAILY_DOMAIN_ID` (domain UUID for the meeting-token `d` claim)
   if GET `/v1` does not return it.
3. Create a Daily REST API key. Store as `DAILY_API_KEY`. Never log it.
4. Room names are deterministic: `eleva-{bookingId}` (ADR-018, standard
   domain). HIPAA random names apply only after D-07. Do not rename rooms in
   the Daily dashboard.

## Webhook

Create a webhook in the Daily dashboard:

| Environment | URL                                         |
| ----------- | ------------------------------------------- |
| Staging     | `https://api.dev.eleva.care/webhooks/daily` |
| Production  | `https://api.eleva.care/webhooks/daily`     |

Subscribe at least to `meeting.started` and `meeting.ended`. Store the
signing secret as `DAILY_WEBHOOK_SECRET`. Signature failure returns 401.

Phase 15 repeats this for production after staging evidence exists. Do not
point production at a HIPAA domain until D-07.

## Join URLs

Confirmation and 1h-reminder emails deep-link to Eleva join pages
(`/{orgSlug}/sessions/{bookingId}/join` and `/expert/sessions/{bookingId}/join`).
Never paste a raw Daily room URL into member or expert copy.

## Recording and transcripts

Recording stays off. Transcripts and Notes/History are Phase 10 / 16.8 —
not Phase 09.

## Related

- [`environment-matrix.md`](../environment-matrix.md)
- [`integration-runbooks.md`](../integration-runbooks.md) (Daily outage)
- ADR-018, decision-log D-07 (deferred 2026-10-07)
