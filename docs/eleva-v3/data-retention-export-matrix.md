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

### Account deletion grace

- Named working pre-launch constant: `ACCOUNT_DELETION_GRACE_DAYS = 14`
- Role: product grace for `account_deletion_requests.scheduled_for`, not the clinical retention period
- Owner: product (founder working default); DPO/legal re-sign D-12 before go-live

### DSAR export

- Data type: member-requested zip of their own exportable records
- Sensitivity: personal; private Blob only (`BLOB_PRIVATE_READ_WRITE_TOKEN`)
- Export: JSON + CSV zip; 10-minute target; signed URL expires 24h
- Deletion: the private Blob object is deleted when `dsar_requests.status` → `expired` (Phase 5.3 expiry job). Signed URL expiry is not enough — the zip must be removed from the private store.
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
- Deletion: depends on operational value and policy
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
