# Eleva.care messaging framework

**Status:** Living  
**Canonical voice reference:** [`_context/clone-repo/eleva-care-app/_docs/04-development/tone-of-voice-guide.md`](../../../_context/clone-repo/eleva-care-app/_docs/04-development/tone-of-voice-guide.md)

This page turns the tone guide and product copy into a **repeatable messaging stack** for campaigns, landing pages, and sales.

## One-liner (internal)

**Eleva Care connects women with independent women’s health experts through a trusted digital platform**—we provide the technology; your chosen expert provides your care.

## Message map

| Layer               | Job                  | Example direction (not fixed copy)                                                           |
| ------------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| **Category**        | What we are          | Trusted platform for women’s health expertise; book and meet on your schedule                |
| **Differentiation** | Why not a clinic app | We connect you to **independent** experts; we are not the care provider                      |
| **Proof**           | Why believe          | Licensed experts, secure platform, clear platform vs. expert roles (substantiate per market) |
| **Action**          | What to do           | Find an expert, book, join as an expert, partner for organizations                           |

## Proof points (use when true and approved)

- **Access** — Remote consultations and scheduling that fit life, not only clinic hours.
- **Clarity** — Plain language on who does what (platform vs. expert).
- **Evidence mindset** — Story and content lean on science and responsible health information (see evidence and about content in MVP).
- **Trust & safety** — Security and compliance posture as listed in product footers (do not overclaim beyond legal review).

## Audiences

### Clients (people booking care)

- **Primary emotions:** Relief, clarity, control, dignity.
- **Voice:** Warm, direct, never alarmist; **client** not “user” or “patient” in product copy.
- **Must include:** Not for emergencies; expert delivers care; platform facilitates.

### Experts (independent professionals)

- **Primary emotions:** Professional respect, autonomy, fair platform.
- **Voice:** Peer-to-peer confident; **expert** and **independent**; avoid employer language unless describing a legal fact.
- **Must include:** Payouts/booking rules as per product; no implied employment by Eleva.

### Partners (clinics, employers, orgs)

- **Primary outcomes:** Reach, operations, brand-safe digital layer.
- **Voice:** B2B clear; still human, not enterprise-bland.
- **Must include:** White-label is an **enterprise** mode; default is co-branded or “powered by” unless contracted.

### Legal / compliance surfaces

- **Voice:** Precise and readable; not “marketing voice.”
- Keep master brand warmth **out of** legal disclaimers if it weakens precision; use a short human intro if needed, then terms.

## Headline formulas

- **Benefit + control:** “[Outcome] on your schedule.”
- **Bridge:** “[Science/care idea] made easier to reach.”
- **Role clarity:** “We connect you. Your expert provides your care.”

## Words and phrases to standardize

| Preferred                          | Avoid in public UX                          |
| ---------------------------------- | ------------------------------------------- |
| Expert, care expert                | Generic “provider,” “practitioner” pile-on  |
| Client                             | User, patient (unless clinical context)     |
| Trusted platform                   | “Technology marketplace” as the lead phrase |
| Experts on Eleva Care (where used) | Ambiguous “our doctors” if not accurate     |

## Settings pages: headline, title, hint, popover

Every settings page (account, Space, practice) uses the same levels. Each
level says something the one above it does not.

| Level                                                    | What it holds                                                                                                                              | Example                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Headline (`PageHeader` title)                            | The page's name, as in the sidebar. No eyebrow: the sidebar already says where you are.                                                    | Privacy                                                                                       |
| Page line (`PageHeader` description)                     | One sentence: what you can do here, in second person.                                                                                      | See what you agreed to, choose how we use your data, get a copy of it or delete your account. |
| Card title (`SettingsFieldsetTitle as="h2"`)             | A noun phrase for one job.                                                                                                                 | Where you're signed in                                                                        |
| Card line                                                | Why it matters to the reader or what to do with it. Never the title again.                                                                 | If you see a device you don't recognise, sign it out and change your password.                |
| Label                                                    | A short noun.                                                                                                                              | Time zone                                                                                     |
| Hint (`FieldDescription`)                                | Only when it prevents a mistake or says who sees the value. One line.                                                                      | Session times are shown in this time zone.                                                    |
| Footer status                                            | The current state or the consequence of saving. Never an instruction already on the card, and never what is not switched on yet.           | Saved in this browser and used across Eleva.                                                  |
| Popover (`InfoPopover`, an (i) after the title or label) | Background most people do not need to act: what a passkey is, how AI help works. Its button has a name ("About passkeys").                 | A passkey is saved on your device…                                                            |
| Confirm dialog                                           | What the reader must know before an irreversible step: what is erased, what is kept and why, what happens to bookings. Never in a popover. | Delete your account?                                                                          |
| Toast                                                    | The result of an action, in a few words.                                                                                                   | Your details are saved.                                                                       |

A switch that saves at once says so in the card line ("We save each change
straight away") and has no Save button. Show only choices that change what
Eleva does; when Eleva always does something, say "Always on".

Consent switches use a layered notice. The visible line under the title
says what the choice is for, what it covers and what turning it on means
(health data names "health information" and who uses it). Anything more
goes in a "Details" dialog with a link to the full notice, never only in a
popover. A simple choice (news emails) needs no Details.

## Related

- [Main handbook — Verbal identity](./README.md#2-verbal-identity)
- [Usage examples — B2B and partners](./usage-examples.md#sales-and-b2b-for-organizations)
