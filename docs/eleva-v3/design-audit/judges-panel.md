# The judges panel for the public site

Status: Living. Set up on 2026-11-23 for the public site: homepage, expert
explorer, expert profile, checkout, marketing and landing pages, content
pages, trust and legal pages.

A slice of the public site ships when seven judges, each working alone, give
it 8.5 or more out of 10. This page says who the judges are, what they see,
what they check and how a score is recorded.

A score is a design review. It is not a legal sign-off: the DPO, counsel and
the accountant still decide what the roadmap asks them.

## The seven seats

| Seat | Judges                                           | Scores                                  |
| ---- | ------------------------------------------------ | --------------------------------------- |
| 1    | Awwwards jury: the site as a piece of web design | Four parameters, weighted (see below)   |
| 2    | UI and visual design                             | One score out of 10                     |
| 3    | UX design and flow                               | One score out of 10                     |
| 4    | UX writing                                       | One score out of 10                     |
| 5    | GDPR and privacy                                 | One score out of 10, from the checklist |
| 6    | Compliance, legal and accessibility              | One score out of 10, from the checklist |
| 7    | Security, as a visitor can verify it             | One score out of 10, from the checklist |

**Pass:** every seat gives 8.5 or more, seat 1 has no parameter under 8.0,
and every P1 finding in the slice is closed. Otherwise the slice is revised
and judged again by new judges.

## The judging is blind

- Each judge is a fresh reviewer who has not seen the work being made.
- A judge receives: the after captures (desktop and phone stills, and the
  walkthrough video), the address of the page on a local server when the seat
  has to inspect the page itself (seats 5, 6 and 7), the surface's
  `references.json` with its references and judging criteria, the Awwwards
  library, and this page.
- A judge does not receive: the pull request description, the implementer's
  notes or self-assessment, the before captures, or any earlier score.
- Judges do not talk to each other. Seven reports come back and are recorded
  as they are.
- After a revision the next round uses new judges, so nobody scores their own
  earlier advice.

## What a score means

| Score | Meaning                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------- |
| 9.5   | Better than the saved references on this point. Nothing to add.                                      |
| 8.5   | Stands beside the saved references without looking weaker. Only small, optional improvements remain. |
| 8.0   | Good, with one clear thing a member would notice.                                                    |
| 7.0   | Works, and looks or reads like a template. Several things to fix.                                    |
| 6.0   | A member would hesitate, get lost or lose trust at some point.                                       |
| 5.0   | Does not do its job.                                                                                 |

Judges score in halves. A judge who cannot see something (a state that was
not captured, a header that could not be read) says so under "not proven"
and does not guess.

## What each judge returns

1. The score (seat 1: the four parameters and the weighted score).
2. The three strongest points, each with the capture it shows in.
3. Every finding: severity (P1 blocks, P2 should be fixed, P3 is polish), the
   capture or address it shows in, and what to do instead.
4. Not proven: what the seat could not judge and why.

## Seat 1: the Awwwards jury

Awwwards scores a site on four criteria with fixed weights. The full note,
with a source beside every fact, is in
[`_context/awwwards/evaluation.md`](../../../_context/awwwards/evaluation.md).
Source: [awwwards.com/about-evaluation](https://www.awwwards.com/about-evaluation/),
read on 2026-11-23.

| Parameter  | Weight | What the judge looks at here                                                                                           |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| Design     | 40%    | Art direction, typography, colour, imagery, layout, hierarchy, consistency, the phone layout, the quality of detail.   |
| Usability  | 30%    | Can a visitor do what she came for: navigation, clarity, speed, forms, feedback, accessibility, behaviour on a phone.  |
| Creativity | 20%    | An idea of its own: is it recognisably Eleva with the logo covered, and does any motion or interaction serve the page. |
| Content    | 10%    | Words, photographs and structure: true, useful, well written, nothing filler.                                          |

The weighted score is `0.4 × Design + 0.3 × Usability + 0.2 × Creativity +
0.1 × Content`, each out of 10. The four names and the weights are
Awwwards'. The third column is ours: Awwwards publishes no definition of any
of the four.

**Two numbers, and which one is the gate.** The judge gives each parameter
twice:

1. **On this panel's scale** (the table under "What a score means", where 8.5
   is "stands beside the saved references"). The weighted score on this scale
   is the gate: 8.5 or more, with no parameter under 8.0.
2. **On Awwwards' own scale**, as an honest estimate of where the page would
   land with their jury. This is recorded and is not a gate. The reason: the
   Sites of the Day in `_context/awwwards/library/references.json` scored
   between 7.11 and 7.73 overall, and an Honorable Mention needs 6.5. An 8.5
   on their scale is above every winner in the library, so asking for it
   would only teach judges to inflate. The judge reads the published scores
   in the library first, so the estimate is anchored to real ones.

How Awwwards combines votes, for reference: a site goes to at least 18 jury
members over five days and the three scores furthest from the average are
dropped; validated users vote separately; Site of the Day is the best of the
day, not a pass mark.

**The Developer Award criteria.** Awwwards scores the code of its winners on
six weighted categories, and a site passes above 7: web performance 0.20,
responsive and mobile 0.20, semantics and SEO 0.20, markup and metadata
0.15, animations and transitions 0.15, accessibility 0.10. These are not a
seat. Seats 6 and 7 cover them, and each slice records a Lighthouse run
(performance, accessibility, best practices, SEO) on a phone profile.

## Seats 2, 3 and 4: UI, UX and writing

Each of these seats answers the surface's own judging criteria in
`_context/mobbin/library/{surface}/references.json`, yes or no, with the
references open, and then scores.

**Seat 2, UI and visual design.** Also checks, on every page: one clear
focal point per screen; a type scale with no more than four sizes in view;
one treatment for all photographs; spacing on a steady rhythm; neighbouring
sections that differ in composition; nothing clipped, wrapped badly or
misaligned at 390px and at 1440px; the brand criteria in
`15-brand-art-direction`.

**Seat 3, UX design and flow.** Also checks: the page's one job is doable
from the first screen; the next step is always visible; no dead ends and no
empty state without a way on; back, refresh and a slow network do not lose
her place; the phone path needs no pinch, no sideways scroll and no reach to
the top corners for the main action; errors say what happened and what to do.

**Seat 4, UX writing.** The founder's rule: not verbose, calm, human first,
natural and welcoming. The ten rules, each with a before and after, are in
[`voice-notes.md`](voice-notes.md). Also checks:

- The hero says what Eleva does for the reader in one headline and one line.
- One idea per section, and nothing said twice on a page.
- Second person, plain words, short sentences. No internal, legal or vendor
  words in copy a member reads.
- A button says what happens next ("See times", not "Continue").
- "Members", never "patients" or "users". "Space", never "Workspace".
- No US framework is named anywhere, and no sentence says what Eleva lacks.
- Portuguese is European and formal; Spanish product copy uses "tú".
- Nothing promises a medical result.

## Seat 5: GDPR and privacy

Each check is answered yes, no or not applicable, from a screenshot, the page
source or the browser's network panel.

1. Before any consent, the page sets only strictly necessary cookies and
   makes no request to an advertising or analytics host.
   ([ePrivacy Directive, art. 5(3)](https://eur-lex.europa.eu/eli/dir/2002/58/oj))
2. In the cookie banner, refusing takes the same number of taps as accepting,
   and the two buttons have equal weight.
   ([EDPB guidelines on deceptive design patterns](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-032022-deceptive-design-patterns-social-media_en))
3. Each purpose can be chosen on its own, nothing optional is switched on in
   advance, and cookie settings can be reopened from the footer.
4. Embedded content from another company (a video, a newsletter form, a
   podcast player) loads only after the visitor agrees, and the placeholder
   says who provides it.
5. Every form asks only for what the task needs, and says in one line why
   anything unusual is asked.
   ([GDPR, art. 5(1)(c)](https://eur-lex.europa.eu/eli/reg/2016/679/oj))
6. Where personal data is collected, a short line names who is responsible
   and links to the privacy notice, on the same screen. (GDPR, art. 13)
7. Consent for health information is explicit, separate from the terms, not
   ticked in advance, and says what is processed, who sees it and how to
   withdraw. (GDPR, arts. 7 and 9)
8. Withdrawing a consent is as easy to find as giving it. (GDPR, art. 7(3))
9. A newsletter sign-up is its own choice, never bundled with booking or
   account creation, and says what arrives and how often.
10. The controller is named with its registered address, and there is a
    visible way to ask for access, correction or deletion without an account.
    (GDPR, arts. 12 to 17)
11. No personal data, health topic or email address appears in a URL, a page
    title or an analytics event.
12. No page shows a member's health need to anyone else: no public reviews
    that reveal a condition, no "people also booked" that implies one.

## Seat 6: compliance, legal and accessibility

1. Before paying, she sees the total price with tax, who provides the
   session, who is paid, and the cancellation terms with their date.
   ([Consumer Rights Directive, art. 6](https://eur-lex.europa.eu/eli/dir/2011/83/oj))
2. The button that commits her to pay says so in plain words.
3. The trader behind the site is identified: legal name, registered address,
   registration and tax number, and a contact address.
   ([e-Commerce Directive, art. 5](https://eur-lex.europa.eu/eli/dir/2000/31/oj))
4. Where experts are listed in an order, the main things that decide the
   order are stated, and any paid placement is labelled.
   ([Directive (EU) 2019/2161](https://eur-lex.europa.eu/eli/dir/2019/2161/oj))
5. No design pushes a choice: no countdown that is not real, no pre-selected
   paid extra, no confirm-shaming, no hidden cost.
   ([Digital Services Act, art. 25](https://eur-lex.europa.eu/eli/reg/2022/2065/oj))
6. Claims are true and specific. No medical result is promised, and "checked"
   or "verified" says who checked what.
7. Legal pages show their date, read as published text (no draft marks), and
   exist in each language the site offers.
8. Text contrast is 4.5 to 1 or more, and 3 to 1 for large text, icons and
   the borders of fields and buttons.
   ([WCAG 2.2](https://www.w3.org/TR/WCAG22/), 1.4.3 and 1.4.11)
9. Everything works from the keyboard, the focus ring is always visible, and
   the order of focus follows the page. (WCAG 2.2, 2.1.1, 2.4.3, 2.4.7, 2.4.11)
10. Every target is at least 24 by 24 CSS pixels, and the main actions on a
    phone are 44 or more. (WCAG 2.2, 2.5.8)
11. Headings go in order with one `h1`, landmarks are present, images have
    alt text or are marked decorative, fields have labels, errors are
    announced, and the page declares its language. (WCAG 2.2, 1.1.1, 1.3.1,
    3.1.1, 3.3.1)
12. Motion stops when the visitor asks for reduced motion, nothing flashes,
    and no information is carried by colour alone. (WCAG 2.2, 2.3.3, 1.4.1)
13. The automated accessibility run (`e2e/a11y.spec.ts`) passes on the page.
    The European Accessibility Act has applied to consumer e-commerce since
    28 June 2025.
    ([Directive (EU) 2019/882](https://eur-lex.europa.eu/eli/dir/2019/882/oj))

## Seat 7: security, as a visitor can verify it

1. The page and everything it loads come over HTTPS, with no mixed content.
2. The response carries `Strict-Transport-Security`, a
   `Content-Security-Policy` without `unsafe-inline` scripts where a nonce
   can be used, `X-Content-Type-Options`, `Referrer-Policy`, and a rule
   against framing.
3. Third-party scripts are few, each has a reason, and none loads before the
   consent it depends on.
4. Forms post to the Eleva API. Public forms that create something are
   protected from bots, are rate limited, and validate on the server.
5. Card details are typed into fields hosted by the payment provider, never
   into Eleva's own inputs.
6. No secret, token or personal data sits in the page source, a URL, the
   browser's storage or a client-side log.
7. Links that open another site use `rel="noopener"`, and no link target is
   built from unchecked input.
8. Error and not-found pages show no stack trace, version or internal path.
9. Security claims on the page are specific and true: they name what Eleva
   does (for example, where data is stored and how it is encrypted), never a
   badge with nothing behind it.
10. A cached public page holds nothing that belongs to one visitor.
11. There is a published way to report a security problem.

## Where the scores go

Each round is recorded in `../decision-log.md` under the slice's entry: the
seven scores, the findings that were fixed, and the "not proven" list. A
failed round stays in the record beside the round that passed.
