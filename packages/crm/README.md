# @eleva/crm

Expert-facing relationship layer (Phase 10.2c). Contacts are an expert's
booking-derived members (`listExpertMembers`) overlaid with an optional
`crm_contacts` row (lifecycle stage, tags), plus manual leads the expert
created. Follow-ups belong to the expert who created them.

- Lead email/phone and follow-up notes are encrypted with the org DEK
  (`@eleva/encryption`); member identity always comes from bookings.
- Every write runs in `withAudit` (`crm_contact`, `crm_follow_up`).
- In team orgs each expert sees only members who booked them and their own
  leads and follow-ups.
