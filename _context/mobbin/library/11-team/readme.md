# Clinic (team) admin and membership

> Generated from `references.json` by `docs/eleva-v3/design-audit/build.mjs`. Edit the JSON, then run the build.

Researcher seat: Activation. Date: 2026-11-20. Before captures: `docs/eleva-v3/design-audit/captures/2026-11-14-before/11-team/`.

Invitation acceptance (Phase 11.1c) and the clinic's Team page (Phase 11.2). References show the clinic as a card, one clear question, which email the invite was sent to and a confirmed state with one next step; then one list of people with their role, pending invitations kept apart with Send again and Withdraw, and an invite dialog that says what each role can do and how long the invitation lasts. The Verification page (Phase 11.4) says where the check stands in one sentence, shows the reason when a change is needed, and keeps the form next to it.

## Keep


## Findings

| ID | Sev | Lens | Finding | Do instead | Slice |
| --- | --- | --- | --- | --- | --- |

## Mobbin references

| Ref | App | Pattern | What Eleva takes from it | Mobbin |
| --- | --- | --- | --- | --- |
| [01](img/01-attio-accept-invite-almost-there.jpg) | Attio (web) | Accept page: the workspace as a card, one question, two buttons | Name the clinic and show it as a card; ask one question; offer accept and a gentle 'Not now' (decline) of equal clarity; keep legal lines small under the question. | [open](https://mobbin.com/screens/cc9ec9af-d3e9-4a89-af5e-0e7ddaf46779?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [02](img/02-slack-join-invited-workspace.jpg) | Slack (web) | Join page that says which email the invitation was sent to | Say which email the invitation was sent to; if the signed-in account is different, say so and offer to switch account. | [open](https://mobbin.com/screens/aadc3502-05ad-470b-b3f9-d9db11fcb92a?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [03](img/03-hilos-you-are-invited-card.jpg) | hilos (web) | Invitation card with sender, address and 'Not you?' | Mask the invited address, show who is signed in, and give 'Not you?' to switch. | [open](https://mobbin.com/screens/509e8fe1-9d4e-4e84-a8a8-f83cf2478348?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [04](img/04-craft-invited-joined-state.jpg) | Craft (web) | Invited → joined, with the next step in the same card | After accepting, confirm in place with who and where, and give one button to the clinic dashboard. | [open](https://mobbin.com/screens/42661382-7e20-4ccb-8383-485465f039c2?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [05](img/05-bonsai-team-table-roles-pending.jpg) | Bonsai (web) | One list of people: name, email, role pill, and one primary 'Invite member' | One list of people with name, email and a role pill; one primary 'Invite someone'; confirm a sent invitation with a toast, not a banner. | [open](https://mobbin.com/screens/1b575eab-0659-4b26-bc02-f27cce0b7e9c?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [06](img/06-attio-members-invite-pending-seats.jpg) | Attio (web) | Members page that opens with one line on what you can do, and marks you and pending invites | Open with the headline and one line; mark the signed-in person as '(you)'; show an invitation's state in words on its row. | [open](https://mobbin.com/screens/0061cd35-3252-48c5-bc67-7af8e1b1c9be?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [07](img/07-krea-pending-invites-cancel.jpg) | Krea AI (web) | Pending invitations as their own block with a count and Cancel on each row | Keep invitations in their own block with a count in the heading; each row has Send again and Withdraw. Eleva does not offer 'copy link': the link is only ever emailed to the invited address. | [open](https://mobbin.com/screens/bb421ef5-0798-47d7-a355-95524bd944ba?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [08](img/08-productboard-invite-role-descriptions.jpg) | Productboard (web) | Invite dialog: email, then a role with one line on what it can do | Two fields only (email, role); say in one line what the chosen role can do in the clinic, in the clinic's words, not permission names. | [open](https://mobbin.com/screens/849d1f53-bd7e-4f3c-900a-dedc890ddacd?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [09](img/09-dub-invite-validity.jpg) | Dub (web) | Invite dialog that says how long the invitation is valid | Say in the dialog what the person receives and that the invitation is valid for 7 days; show the last valid day on the pending row. | [open](https://mobbin.com/screens/b810f603-540c-4891-a0f2-9358d8714a58?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [10](img/10-airwallex-reviewing-your-details.jpg) | Airwallex (web) | One card that says where the check stands, in a full sentence | The Verification page leads with one card: the state as a sentence ('We are checking your details') and one line on what the clinic has to do, which is usually nothing. | [open](https://mobbin.com/screens/5b2e67a8-ded8-496b-80f0-d2aa8ab4ae03?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [11](img/11-stripe-what-happened-what-to-do.jpg) | Stripe (web) | When something is needed: what happened, then what to do now | When staff ask for a change, show their reason under 'What to change' and put the form right below it, already filled with what was sent. | [open](https://mobbin.com/screens/b24bf79e-1acc-4d99-9f38-b81aa68daaf8?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [12](img/12-mercury-no-action-needed.jpg) | Mercury (web) | 'No action is needed on your end' while someone else has the next step | While Eleva checks, say plainly that the clinic does not need to do anything, and show what was sent and when. | [open](https://mobbin.com/screens/2a7de612-6f88-42d7-bce5-1d8fe2219314?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |

## Judging criteria

A review panel scores a new design for this surface against these, with the references open.

1. Does the page name the clinic and who invited her, and show which email the invitation was sent to? (Attio 11-team/01, Slack 11-team/02, hilos 11-team/03)
2. Is there one clear accept action and an equally clear way to decline or not now, with what happens next said in plain words? (Attio 11-team/01, Craft 11-team/04)
3. If the signed-in account does not match the invitation, does the page say so and offer to switch, instead of failing? (hilos 11-team/03, Slack 11-team/02)
4. Do expired, cancelled and already-used invitations each say what happened and what to do? 
5. On the Team page, can a clinic admin see within 5 seconds who is in the clinic, each person's role and who has a published service, with one clear way to invite? (Bonsai 11-team/05, Attio 11-team/06)
6. Are pending invitations kept apart from people, each with its last valid day (or that it expired) and with Send again and Withdraw on the row? (Krea 11-team/07, Attio 11-team/06)
7. Does the invite dialog ask only for email and role, say in plain words what the role can do and how long the invitation is valid, and refuse a bad address or an existing member with a sentence that says what to do? (Productboard 11-team/08, Dub 11-team/09)
8. Before someone is removed, does the confirmation name the person and the clinic and say what happens to their access, their services and their account, and does a refusal (sessions still to run, the owner, yourself) say why and what to do first?
9. On the Verification page, can a clinic admin tell in one sentence where the check stands and whether anything is needed from them? (Airwallex 11-team/10, Mercury 11-team/12)
10. When Eleva asks for a change or cannot verify, does the page show the reason in Eleva's own words and put the form to send new details right below it, filled with what was sent? (Stripe 11-team/11)
11. Does the form ask only for the legal name and the tax number, say what Eleva does with them, and refuse a malformed number with a sentence that says what a valid one looks like?
