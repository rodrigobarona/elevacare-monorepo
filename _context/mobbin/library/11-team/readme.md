# Clinic (team) admin and membership

> Generated from `references.json` by `docs/eleva-v3/design-audit/build.mjs`. Edit the JSON, then run the build.

Researcher seat: Activation. Date: 2026-11-15. Before captures: `docs/eleva-v3/design-audit/captures/2026-11-14-before/11-team/`.

Invitation acceptance, the first team surface built (Phase 11.1c). References show the clinic as a card, one clear question, which email the invite was sent to, and a confirmed state with one next step.

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

## Judging criteria

A review panel scores a new design for this surface against these, with the references open.

1. Does the page name the clinic and who invited her, and show which email the invitation was sent to? (Attio 11-team/01, Slack 11-team/02, hilos 11-team/03)
2. Is there one clear accept action and an equally clear way to decline or not now, with what happens next said in plain words? (Attio 11-team/01, Craft 11-team/04)
3. If the signed-in account does not match the invitation, does the page say so and offer to switch, instead of failing? (hilos 11-team/03, Slack 11-team/02)
4. Do expired, cancelled and already-used invitations each say what happened and what to do? 
