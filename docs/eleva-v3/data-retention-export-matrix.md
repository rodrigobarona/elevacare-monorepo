# Eleva.care v3 Data Retention And Export Matrix

Status: Living

## Purpose

This document provides a practical matrix for how major Eleva data types should be treated for retention, deletion, export, and audit purposes.

It should be used as a product-engineering-operational reference, not as a final legal policy.

The exact durations and rules still require legal/compliance validation.

## How To Use This Matrix

Use this document to answer:

- what kind of data this is
- whether it is likely sensitive
- whether it should be exportable
- whether deletion is simple, constrained, or layered
- whether access should always be audited

## Matrix

### Account and identity data

- Data type: user account/profile data
- Sensitivity: personal data
- Export: yes
- Deletion: generally deletable subject to operational/legal constraints
- Audit access: when changed or accessed through admin-sensitive flows

### Membership and permission data

- Data type: org memberships, roles, permissions
- Sensitivity: internal/security-sensitive
- Export: yes where relevant to account/workspace transparency
- Deletion: usually replaced by deactivation/history rather than full erasure in all cases
- Audit access: yes for changes

### Invitations to a clinic

- Data type: the invited email address, the role offered, who invited, when
  it was sent and how it ended (`auth.invitation`); the audit rows carry the
  invitation id and role, never the address. For someone with no Eleva
  account the address is also on the delivery record of each invitation
  email (`notification_deliveries.recipient_email`), which follows the
  notification delivery period below (365 days)
- Sensitivity: personal data of someone who may not have an Eleva account;
  the address is supplied by the clinic
- Export: yes for the clinic (its pending invitations, `GET /teams/{teamId}/members`);
  the invited person sees their own invitation on the accept page
- Deletion: a pending invitation stops working after 7 days. **Proposed, for
  the DPO to confirm:** accepted, declined, withdrawn and expired invitations
  are deleted 90 days after they end. A declined invitation's row is what
  keeps the clinic from inviting that address again (for 30 to 37 days):
  whatever period is chosen must stay above 37 days, or a decline is
  forgotten early. The sweep is Phase 13 work; until it ships these rows
  stay. The DPO also decides whether the delivery record
  of an invitation to a non-account address keeps the 365 days or follows
  the invitation (the two periods must be stated together)
- Audit access: yes for sending, withdrawing, accepting and declining
- Transparency: the invitation email names the clinic and the person who
  invites and says why the email was sent. **Proposed privacy-notice line,
  for the DPO to word and publish:** "If a clinic invites you to join its
  team, they give us your email address so we can send you
  the invitation. We keep it until you answer or the invitation expires,
  and for [period] afterwards, with the record that the email was sent."

### Clinic verification filings

- Data type: a clinic's legal name and tax number, the staff decision, who
  decided and when, and the reason on a filing that was sent back or
  rejected (`clinic_verifications`). Staff also read, without storing a
  copy, the clinic's billing address and website and the name of its owner
- Sensitivity: business data, plus personal data of the owner (name; the
  email is no longer shown to staff or returned by the staff API) and of
  the reviewer (staff user id). When the clinic is a sole trader, the legal
  name, tax number and billing address are that person's personal data
- Export: yes for the clinic (`GET /teams/{teamId}` returns its filing, the
  state and the reason)
- Deletion: an approved filing is the clinic's verification record and is
  kept while the clinic exists (its reviewer cannot be deleted from under
  it). **For the DPO to decide:** how long rejected and superseded filings
  and their reasons are kept; nothing deletes them today
- Notices: each decision is sent to the clinic's owner and admins by email
  and inbox notice (11.5). The email carries the reason; the delivery log
  follows the notification delivery period below (365 days) and stores no
  email body. The reason is also held in the decision's
  `domain_events_outbox` payload. **For the DPO to decide:** how long
  published events are kept; nothing deletes them today
- Audit access: yes for every decision (`clinic_verification.approved`,
  `.changes_requested`, `.rejected`), with the reason in the audit payload;
  staff opening a filing is audited too (`clinic_verification.opened`,
  with the state the filing was in, never its details). The queue, which lists
  clinics by name and legal name (personal data for a sole trader), is not
  recorded per row. **For the DPO to decide:** how long
  `clinic_verification.opened` rows are kept; nothing deletes them today
- Transparency: **proposed privacy-notice line, for the DPO to word and
  publish:** "Clinics: we check the legal name, tax number and billing
  address of the clinic, and the name and email of the person who manages
  it, to verify the clinic's legal identity before its page is listed."

### Booking and session metadata

- Data type: bookings, schedule selections, timestamps, session mode, status
- Sensitivity: personal and operational
- Export: yes
- Deletion: constrained; should account for finance/audit relationships
- Audit access: yes for admin-sensitive operations

### Payment and payout metadata

- Data type: payment states, payout states, commission records, invoice links
- Sensitivity: financial/operational
- Export: yes where user/org facing
- Deletion: constrained due to accounting and audit obligations
- Audit access: yes

### Session notes

- Data type: expert-authored notes
- Sensitivity: high
- Export: likely yes where policy and product allow
- Deletion: must be policy-driven, not casual
- Audit access: yes

### Session reports

- Data type: expert-reviewed or approved reports
- Sensitivity: high
- Export: yes
- Deletion: policy-driven and potentially constrained
- Audit access: yes

### Uploaded documents

- Data type: PDFs, attachments, worksheets, related files
- Sensitivity: high
- Export: yes where owned/shared
- Deletion: policy-driven and auditable
- Audit access: yes

### Session documents (`session_documents`, private R2 bucket)

- Data type: expert/member uploads on a booking (PHI bytes in the private store)
- Sensitivity: clinical / PHI
- Export: yes (DSAR metadata; signed download while the row exists)
- Deletion: `POST /workflows/retention-sweep` hard-deletes rows older than `SESSION_DOCUMENT_RETENTION_DAYS` (working pre-launch **7×365 days** in `@eleva/compliance`; DPO sets the final period before GA). Order: **object delete first**, then row. Failed object deletes increment `retention_sweep_attempts` and stop after 3 attempts.
- Audit access: yes (`session_document.deleted`, reason `retention`)

### Transcript artifacts

- Data type: call transcripts and transcript-derived artifacts
- Sensitivity: high
- Export: likely yes if part of the user-visible record model
- Deletion: must be explicitly defined and auditable
- Audit access: yes

### AI drafts

- Data type: generated draft summaries/reports
- Sensitivity: high if derived from sensitive inputs
- Export: depends on whether drafts are part of the user-visible record
- Deletion: should be explicitly defined
- Audit access: yes

### Diary entries and tracked mobile data

- Data type: patient-generated diary data
- Sensitivity: high
- Export: yes
- Deletion: should be patient-aware and policy-driven
- Audit access: yes when shared/accessed by experts

### Consents — account scope (`booking_id IS NULL`)

- Data type: marketing (and later analytics, account terms/privacy) grants not tied to a booking
- Sensitivity: personal / compliance-critical
- Export: yes (DSAR)
- Deletion: erased on the account-deletion sweep (D-12 working pre-launch)
- Audit access: yes (`consent` granted / withdrawn)

### Consents — booking scope (`booking_id IS NOT NULL`)

- Data type: funnel consents that authorised a booking
- Sensitivity: compliance-critical
- Export: yes (DSAR); after deletion the row keeps `subject_pseudonym` only
- Deletion: pseudonymise (`user_id` → NULL, `subject_pseudonym` = HMAC of the former user id under `RETENTION_PSEUDONYM_KEY`, `guest_email_hash` → NULL) and retain for the Portuguese clinical-record minimum. DPO fills the year before go-live; **do not invent a year number** in engineering.
- Audit access: yes; audit events keep the pseudonym

### Session records — expert-authored (`records.created_by` ≠ member)

- Data type: encrypted notes, internal reports, published session reports, transcripts and intake about a member
- Sensitivity: clinical / PHI; ciphertext under the expert org key
- Export: published reports only (DSAR, member-visible)
- Deletion: on account deletion, `member_user_id` → NULL and `subject_pseudonym` = HMAC of the former user id under `RETENTION_PSEUDONYM_KEY`. The row stays under the clinical-record retention exception. The hard delete at the end of the statutory period is **not scheduled** until the DPO sets the period; do not invent a year number in engineering
- Audit access: yes (`account_deletion_request` payload counts tombstoned rows)

### Session records — member-authored (`records.created_by` = member, or `kind = intake`)

- Data type: rows the member wrote about themselves, including the booking-form intake that is stored with the expert as `created_by`
- Sensitivity: clinical / PHI
- Export: yes (DSAR)
- Deletion: deleted on the account-deletion sweep
- Audit access: yes

### Unpublished AI drafts (`records.kind = ai_draft`, `published_at IS NULL`)

- Data type: AI-generated report drafts awaiting expert review
- Sensitivity: clinical / PHI
- Export: no (never member-visible)
- Deletion: `POST /workflows/retention-sweep` deletes drafts 90 days after their last change (daily, batched)
- Audit access: yes (`record.deleted`, one event per org batch with the count)

### Account deletion grace

- Named working pre-launch constant: `ACCOUNT_DELETION_GRACE_DAYS = 14`
- Role: product grace for `account_deletion_requests.scheduled_for`, not the clinical retention period
- Owner: product (founder working default); DPO/legal re-sign D-12 before go-live

### DSAR export

- Data type: member-requested zip of their own exportable records
- Sensitivity: personal; private R2 bucket only (`R2_PRIVATE_*`)
- Export: JSON + CSV zip; 10-minute target; signed URL expires 24h
- Deletion: the private object is deleted when `dsar_requests.status` → `expired` (Phase 5.3 expiry job). Signed URL expiry is not enough — the zip must be removed from the private store.
- Audit access: yes (`dsar_request` requested / ready / expired / failed)

### Consent and visibility records

- Data type: consent grants, sharing permissions, visibility windows
- Sensitivity: compliance-critical
- Export: yes where relevant
- Deletion: split by D-12 — see the two consent-scope rows above; do not treat all consents as one erasure rule
- Audit access: yes

### Notification delivery records

- Data type: notification intents and delivery metadata
- Sensitivity: operational, sometimes personal
- Export: selective
- Deletion: `POST /workflows/retention-sweep` deletes `notification_deliveries` rows older than **365 days** (batched). User-scoped auth kinds (`org_id IS NULL`) purge without org audit; org-scoped rows emit `notification.deleted` (scope `delivery_log`).
- Audit access: for critical flows

### Audit logs

- Data type: immutable historical security/compliance events
- Sensitivity: high operational/compliance value
- Export: selective/admin-oriented
- Deletion: highly constrained
- Audit access: yes and restricted

### Operational logs

- Data type: structured logs, request traces, integration failures
- Sensitivity: should be minimized
- Export: generally not an end-user export artifact
- Deletion: retention-based
- Audit access: restricted operational access

## Practical Rules

- Do not assume all user deletion means immediate physical erasure of all linked records.
- Distinguish between user-visible deletion, policy retention, and immutable audit needs.
- Keep export scope understandable for users and operators.
- Keep sensitive-content access auditable.

## Required Follow-Up Work

The team should later enrich this matrix with:

- exact retention durations
- system-of-record location
- encryption/storage policy
- legal basis notes
- export format notes
- deletion workflow notes

## Related Docs

- [`compliance-data-governance.md`](./compliance-data-governance.md)
- [`ai-reporting-spec.md`](./ai-reporting-spec.md)
- [`mobile-integration-spec.md`](./mobile-integration-spec.md)
- [`ops-observability-spec.md`](./ops-observability-spec.md)
