# Staff console: verification queues

> Generated from `references.json` by `docs/eleva-v3/design-audit/build.mjs`. Edit the JSON, then run the build.

Researcher seat: Trust and operations. Date: 2026-11-21. Before captures: `docs/eleva-v3/design-audit/captures/2026-11-14-before/13-admin/`.

The clinic verification queue (Phase 12). References show the details to check grouped under plain labels, a short checklist where each item has its own state, and a status said in words on every row. The screens follow the licence review already shipped, so staff learn one pattern.

## Keep


## Findings

| ID | Sev | Lens | Finding | Do instead | Slice |
| --- | --- | --- | --- | --- | --- |

## Mobbin references

| Ref | App | Pattern | What Eleva takes from it | Mobbin |
| --- | --- | --- | --- | --- |
| [01](img/01-stripe-review-grouped-details.jpg) | Stripe (web) | What was sent, grouped under plain labels, each value on its own line | Show the filing as label and value pairs (legal name, NIF, billing address, website); numbers in a monospace face; the register links right under the value they check. | [open](https://mobbin.com/screens/d8b29b26-595c-487b-af8c-04b9762468ef?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [02](img/02-klaviyo-review-checklist-states.jpg) | Klaviyo (web) | A short checklist where every item is one sentence and the action stays off until all pass | Two checks as full sentences; Approve stays disabled until both are ticked; one line says what to do to approve. | [open](https://mobbin.com/screens/02359910-64f7-4f23-8280-f1bf18c8e95f?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [03](img/03-revolut-verify-status-in-words.jpg) | Revolut Business (web) | Status in words on every row, and who has to act | Queue states say who acts next: 'To check' (staff) and 'Waiting on the clinic'; decided filings read 'Verified' or 'Rejected'. | [open](https://mobbin.com/screens/f0b8e9cd-a445-496f-8752-b6ed7a6d3728?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |

## Judging criteria

A review panel scores a new design for this surface against these, with the references open.

1. In the queue, can staff see which filings wait on them and which wait on the clinic, oldest first, with the clinic and its legal name on the row? (Revolut Business 13-admin/03)
2. On a filing, is everything staff must compare (legal name, NIF, billing address, website, owner) on one screen, with the public register one click from the value it checks? (Stripe 13-admin/01)
3. Is approving impossible until both checks are confirmed, and are sending back and rejecting impossible without a reason the clinic can read? (Klaviyo 13-admin/02)
4. After a decision, does the page say what happened and what happens next, and does a refusal (already decided, new details, your own clinic) say what to do?
