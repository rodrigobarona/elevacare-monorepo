# Account settings

> Generated from `references.json` by `docs/eleva-v3/design-audit/build.mjs`. Edit the JSON, then run the build.

Researcher seat: Dashboards. Date: 2026-11-16. Before captures: `docs/eleva-v3/design-audit/captures/2026-11-14-before/12-account-settings/`.

A person had two settings pages and two privacy pages. /space/settings and /account/settings both edited the same photo, name and language on the user record, but each held only some controls: time zone, theme and notifications were only in the Space, and password, two-step verification, passkeys and devices only in /account. /account/privacy was a signpost to /space/privacy. The fix is one home for everything about the person, /account, in short pages (Profile, Notifications, Security, Privacy, Workspaces, Billing for practices), with a strict hierarchy: one headline and one line per page, one title and one line per card, a hint only where it prevents a mistake or says who sees a value, and background explanation in an (i) popover.

## Keep

- The cards, Lora headings and one teal action per block are calm and on brand; the merge keeps them.
- Every control already went through apps/api (/me, /users, /privacy) with Zod and audit, so moving the pages needs no API change.
- Privacy was complete: consents, a data copy with status, and deletion with a 14-day waiting period that can be cancelled.
- Passkeys, two-step verification and Google linking were already wired to Better Auth.

## Findings

| ID | Sev | Lens | Finding | Do instead | Slice |
| --- | --- | --- | --- | --- | --- |
| ACC-01 | P1 | ux | Two settings pages and two privacy pages for the same person | One home for everything about the person: /account. Pages: Profile (photo, name, email, language, time zone, appearance), Notifications, Security, Privacy, Workspaces, and Billing only for practices and clinics. /space/settings and /space/privacy redirect there, and the Space sidebar keeps Settings and Privacy under an 'Account' group that opens /account. | D5.8 |
| ACC-02 | P1 | trust | Notification switches promise choices Eleva does not honour | Show only real choices. Sessions and reminders: email and in-app switches that save at once (the backend honours them). Payments and Account and security: switches that are on and locked, marked 'Always on'. Point news from Eleva to the Privacy page. Bring back text messages and quiet hours together with adding and verifying a mobile number. | D5.8 |
| ACC-03 | P1 | trust | Sign-up does not record Terms and Privacy acceptance | Record terms and privacy (current CONSENT_DOCUMENT_VERSION) when the account is created, from the sign-up screen's agreement, through @eleva/compliance with audit. Then 'What you agreed to' shows 'Agreed on {date}' for everyone. Needs legal review of the sign-up wording. | D5.3 |
| ACC-04 | P2 | ux | Security mixed into profile, with raw device strings and a hidden 2FA step | A Security page: Password (or one line saying none is needed), Two-step verification as a short dialog (password, setup key with copy and an app link, backup codes, code), Passkeys with a list and an empty state, Google, and 'Where you're signed in' with 'Chrome on macOS', 'This device', last active, 'Sign out' and 'Sign out of all other devices'. | D5.8 |
| ACC-05 | P2 | copy | No hierarchy between headline, title, hint and help | Headline and one line per page, no eyebrow. Card: title and one line on why it matters. Field: label, and a hint only when it prevents a mistake or says who sees the value. Footer: state or consequence, then the action. Background in an (i) popover with an accessible name. What a member must know before an irreversible step goes in the confirm dialog. | D5.8 |
| ACC-06 | P2 | ux | Billing offers expert and clinic plans to members | Show Billing only to people with an expert practice or a clinic; a member who opens the address sees that receipts live in her Space with a link to Payments. Plan copy, translations and moving plans into practice settings follow in the expert consistency pass. | D5.8 |
| ACC-07 | P2 | copy | Consent switches carry the whole notice inline | Layered notice: each row shows the purpose, what it covers and what turning it on means in one line (health data names 'health information' and who uses it); a 'Details' dialog holds the bullets and the link to the full notice. News needs no Details. | D5.9 |

## Mobbin references

| Ref | App | Pattern | What Eleva takes from it | Mobbin |
| --- | --- | --- | --- | --- |
| [01](img/01-linear-security-sessions-passkeys.jpg) | Linear (web) | Security as short sections: sessions, passkeys, apps | Eleva Security: one card per sign-in method, the current device first and marked 'This device', a 'Sign out of all other devices' action, and an empty passkey state in words. | [open](https://mobbin.com/screens/13e6c6f5-0ec6-49d8-83e4-921de2120ae1?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [02](img/02-render-account-settings-sections.jpg) | Render (web) | Account settings split into named sections, with a hint under each setting | Split Eleva's single long settings page into named pages in the sidebar, and give each setting a label plus at most one line of hint. | [open](https://mobbin.com/screens/e5443435-1a97-4801-85b7-7e8a60fa0738?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [03](img/03-stackai-profile-section-hints.jpg) | StackAI (web) | Section title, one line of purpose, then fields with a hint under each label | Eleva cards: title, one line on why it matters to the member, then fields; the photo has an explicit 'Upload a photo' button with the format hint beside it, not a hidden 'click the photo'. | [open](https://mobbin.com/screens/b82f1e2f-4e92-41fa-bec4-5471da0e0416?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [04](img/04-plain-profile-field-hints.jpg) | Plain (web) | Field hints that say who sees the value | Eleva's details card says who sees the photo and name: 'Experts see your photo and name when you book with them.' | [open](https://mobbin.com/screens/72c9cfb4-253a-4499-87ec-8919a2755818?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [05](img/05-kiwi-where-you-are-signed-in.jpg) | Kiwi.com (web) | Signed-in devices in plain words, with a sign-out per device | Name the devices card in member words ('Where you're signed in'), show 'Chrome on macOS', and say what to do about a device you don't recognise. | [open](https://mobbin.com/screens/2870f941-a2f7-4059-9d73-f3e7d14920a7?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [06](img/06-pipedrive-your-devices.jpg) | Pipedrive (web) | This device badge and the next step for a suspicious sign-in | A 'This device' badge instead of a sign-out on the current session, and the one-line advice in the card description. | [open](https://mobbin.com/screens/7ed47d98-c70b-4186-ac34-5a9b8bf02028?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [07](img/07-square-dotted-underline-tooltip.jpg) | Square (web) | Background explanation in a small popover, not on the page | Eleva's info popover holds background a member may want but does not need to act (what a passkey is, how AI help works, where 'In Eleva' messages appear). What she must know before acting stays on the page or in the confirm dialog. | [open](https://mobbin.com/screens/afbe8fd9-3b5e-4075-837a-9deb79d16841?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [08](img/08-quickbooks-label-help-icon.jpg) | QuickBooks (web) | A help icon next to a setting's label | Put the (i) next to the section title or label it explains, give it an accessible name ('About passkeys'), and keep one sentence of hint on the page. | [open](https://mobbin.com/screens/513b0cd9-85b2-463c-9e5f-957566ae3295?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [09](img/09-deel-two-step-scan-step.jpg) | Deel (web) | Two-step setup as one goal per step, with 'Step 2 of 3' and what comes next | Eleva's two-step dialog: confirm the password, scan, enter the code, then save backup codes, each its own step with 'Step x of 4', Back and one primary button. | [open](https://mobbin.com/flows/b357dfee-69ed-438c-bcff-053293dd8040?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [10](img/10-braintrust-cant-scan-link.jpg) | Braintrust (web) | The setup key hides behind 'Can't scan QR code?'; backup codes come after setup | Show the key only when someone asks for it, and show backup codes after the code is accepted, as the last step. | [open](https://mobbin.com/flows/e7c9eacd-5388-4e3d-a25d-092da52b1131?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [11](img/11-claude-privacy-learn-more.jpg) | Claude (web) | Each privacy switch has a title and one line, with 'Learn more' for the rest | Consent rows show the purpose and what turning it on means in one line; a 'Details' dialog holds the bullets and the notice link. | [open](https://mobbin.com/screens/cbdae8ff-ad61-4e7d-8ba6-767a5337c317?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |
| [12](img/12-airbnb-privacy-learn-more.jpg) | Airbnb (web) | Short consequence line under each switch, 'Learn more' inline | Keep the visible line to the consequence ('You need this on to book', 'Off unless you turn it on'); no Details for simple choices like news. | [open](https://mobbin.com/screens/fb98988d-3bfe-48e3-8c33-0a41db9e4afc?utm_source=claude-code&utm_medium=ai-assistant&utm_source_platform=mcp) |

## Judging criteria

A review panel scores a new design for this surface against these, with the references open.

1. Is there exactly one place to change each personal setting, and do old Space addresses land there? (12-account-settings/02)
2. Does every page have one headline and one line, every card one title and one line, and does each hint either prevent a mistake or say who sees a value? (12-account-settings/03, 12-account-settings/04)
3. Is background help in an (i) popover with an accessible name, while what a member must know before deleting her account stays in the dialog she confirms? (12-account-settings/07, 12-account-settings/08)
4. Does every notification switch change what Eleva sends, with 'Always on' where it cannot? (12-account-settings/01)
5. Can she tell at a glance what she agreed to (dated, readable) apart from the choices she can switch on and off? (10-member-space/08)
6. Does the devices list name devices in plain words, mark this device, and let her sign out of the others in one step? (12-account-settings/05, 12-account-settings/06)
7. On a 390 px screen, does every page fit without sideways scrolling, with actions on the same line as the row they belong to? (12-account-settings/01)
8. Does each consent switch say, in one visible line, what it is for and what turning it on means, with the rest one tap away in Details and the full notice linked? (12-account-settings/11, 12-account-settings/12)
