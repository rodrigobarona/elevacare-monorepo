# Expert Profile, Directory and Booking UX Spec (v3, revision 2.2)

Status: revision 2.2 (2026-11-07), founder feedback round, council-reviewed. Supersedes the
2026-10-19 layout draft; the founder decisions from that date still hold
unless this revision says otherwise.

## Why this revision

Founder feedback on dev (2026-11-07):

- The directory "looks like a shop": 10 area chips, a language select, a sort
  select and an "Apply filters" button sit above four experts.
- The expert profile is "weak, cold and boring". It should be the expert's own
  small home on Eleva, a page they are proud to share. The old production
  profile (`eleva.care/patimota`) is better but still not good enough.
- The booking flow is not engaging and the details form is "huge and not
  caring". Airbnb's checkout and its thank-you page are the bar. Eleva must
  beat Cal.com, Calendly, HubSpot Meetings, Doctolib and Zocdoc.

## Research panel (2026-11-07)

Two researchers fetched the live pages and docs. Raw captures are kept out of
the repo; the findings that drive this spec:

- **intro.co** (homepage, `/marketplace`, profiles `/ElissaGoodman`,
  `/justinwelsh`, `/drsebagh`): tall rounded portrait column (~360 px), name
  with a check, a headline that reads like a title, a first-person "About me"
  that names real proof (clients, books, outlets), one or two offers with
  "What to expect" bullets, slot picker inline, sticky mobile bar "price ·
  See times". The directory is topic tabs with one heading each plus a grid of
  big photo cards; filters exist but are tucked away.
- **Old Eleva production** copies that intro.co pattern (400 px portrait, chips,
  social icons, bio, offer cards with "What to expect / Ideal for"). It beats
  dev on warmth. Dev beats it on facts (policy, modes, languages, countries)
  but shows those facts as the hero.
- **Booking tools**: no product shows a slot count per day; time zone is one
  line of text, not a full-width control; picking a time is the commit; forms
  are name, email and at most one optional box; a summary stays in view.
  Calendly's split button ("09:00 | Next") keeps an explicit confirm without
  leaving the grid.
- **Airbnb "Confirm and pay"**: numbered sections on the left (your trip,
  payment, required info as short rows, cancellation as one dated sentence,
  ground rules, small print), sticky price card on the right, one button that
  says exactly what happens. The confirmation page leads with a celebratory
  hero, the host's face and everything needed for the trip above the fold.
- **Forms research** (Baymard, NN/g, web.dev): fewer fields beat fewer steps;
  one "Full name" field; promo and invoice fields behind a link; validate on
  blur, never while typing; offer account creation only after the booking.
- **Consent** (EDPB 05/2020): consent must be specific, unbundled and never
  pre-ticked. The privacy notice is information (GDPR art. 13), not consent;
  health-data processing (art. 9) needs its own affirmative act.

## Principles

1. **The expert is the hero, Eleva is the host.** Every screen shows the
   expert's face and name; Eleva's chrome stays quiet.
2. **One goal per screen.** Directory: choose a person. Profile: trust and
   pick a service. Time: pick a time. Confirm: say yes. Thank-you: feel
   looked after and know what happens next.
3. **Only real proof.** No stars, counts, "Top Expert" or verification badges
   on profiles (founder 2026-10-19). The directory's "Top Expert · paid plan"
   label is the paid-ranking disclosure (decision log 2026-11-07), not proof,
   and stays. Empty blocks are hidden, never shown as "0" or "Price on
   request".
4. **Care in the copy.** Second person, plain words, "members", say what Eleva
   does for the reader. EN, PT and ES are written natively.
5. **Nothing is lost.** Every decision is reversible until the member pays;
   every step keeps what was typed.

## Design council

Five judges score every revision from 0 to 10 per surface. The bar is
**8.0 or better from every judge on every surface** before a slice ships.

| Judge                                                                | Lens                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| 1. Product design lead (ex-Airbnb guest checkout and host profiles)  | hierarchy, emotion, delight, brand                    |
| 2. Booking conversion specialist (Calendly growth, Baymard research) | friction, drop-off, mobile conversion, recovery       |
| 3. EU digital-health trust and privacy reviewer                      | honest claims, GDPR consent, clinical safety, refunds |
| 4. Accessibility and mobile engineer (WCAG 2.2 AA, React Aria)       | keyboard, screen readers, 360 px, focus, performance  |
| 5. UX writer and expert advocate                                     | warmth, EN/PT/ES voice, "would an expert share this?" |

Round 1 (revision 2): overall 7.9 / 7.9 / 7.5 / 7.5 / 7.9. Round 2
(revision 2.1): 8.4 / 8.4 / 8.5 / 8.4 / 8.5, every surface ≥ 8.0 except
Thank-you for judge 3 (7.8: guests were told when they can cancel but not
how). Revision 2.2 adds that route and the judges' build conditions.
Round 3 (revision 2.2): **8.4 / 8.4 / 8.7 / 8.4 / 8.5, every surface ≥ 8.0
for every judge.** Deferrals are listed with their reason under "Slices".
Each slice is re-scored against its build before merge.

## 1. Directory (`/experts`, `/experts/[category]`)

```
  FIND YOUR EXPERT
  Find the right women's health expert for you      (display serif)
  Real people with real training. Pick someone whose work fits you,
  then meet by video, by phone or in person.

  [All] [Physiotherapy] [Pelvic health]           <- only areas that have experts

  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │   portrait   │ │   portrait   │ │  soft cream  │   4:5, rounded
  │     4:5      │ │              │ │  monogram    │   (no photo)
  ├──────────────┤ ├──────────────┤ ├──────────────┤
  │ Fisio Mota   │                                    name (the link)
  │ Women's health physio… (2 lines)                  headline
  │ Physiotherapy · Pelvic health · From €45          one meta line
  └──────────────┘
  Mobile (< 640 px): horizontal cards, 96 × 120 portrait left, text right.

  Before a profile goes live, our team checks the expert's professional
  registration.  How we order experts →
```

- **No filter bar while the directory is small.** Below
  `DIRECTORY_FILTERS_MIN_EXPERTS` (12) listed experts, the language select,
  sort select and "Apply filters" button are not rendered. Deep links with
  `?language=` keep working and show one removable pill whose accessible name
  is "Remove filter: speaks Portuguese".
- **Area chips are built from the experts listed**, not the full taxonomy,
  and are links with `aria-current="page"` on the active one. The row is
  hidden when fewer than two areas have experts. In a category view the chips
  come from the unfiltered list, so the member can always switch.
- **Cards are calm**: three text lines only (name, headline clamped to two
  lines, one meta line: up to two areas of care, then the price: "From €45",
  "Free session available" when the lowest offer is free, nothing when
  unknown).
  How they meet joins the meta line when the card API carries modes.
  Languages appear on the profile, not the card. The name is the link and its
  hit area stretches over the card. Hover lifts the portrait 2 px (none with
  reduced motion).
- **No photo**: a soft cream frame with a small serif monogram on a light
  brand tint, never a full-bleed orange slab.
- **Trust line**: "Before a profile goes live, our team checks the expert's
  professional registration." True for every listed profile
  (`licenceVerified()`), a one-time check, worded as such.
- Empty category: "No experts in this area yet." with "See all experts".

## 2. Expert profile (`/{username}`): "their small home"

### Desktop

```
 ┌───────────────────────────── warm tinted hero band ─────────────────────────┐
 │ ┌──────────┐   PHYSIOTHERAPY · PELVIC HEALTH        (links)                   │
 │ │          │   Patrícia Mota                        (display serif, 56px)     │
 │ │ portrait │   Women's health physiotherapist · PhD in Biomechanics          │
 │ │   4:5    │   PhD in Biomechanics, Universidade de Lisboa   (1st credential) │
 │ │  rounded │   Speaks Portuguese, English, Spanish · Video and in person,    │
 │ │          │   Lisbon · Members in Portugal and Spain       (one quiet line) │
 │ └──────────┘   (in) (ig) (web)                     [ Share this page ]       │
 └─────────────────────────────────────────────────────────────────────────────┘
 ┌──────────── main column (≤ 680) ──────────────┐ ┌── sticky booking card ──┐
 │ About me                                      │ │ Book a session           │
 │ rich bio; long bios end with Read more        │ │ ( First visit · 60 min ) │
 │                                               │ │ ( Follow-up · 45 min  )  │
 │ How I can help                                │ │ Times in Lisbon time     │
 │ ┌───────────────────────────────────────────┐ │ │ Mon 9 Nov                │
 │ │ 60-MIN VIDEO CALL                €60      │ │ │ [09:00] [09:30] [10:00]  │
 │ │ First visit                               │ │ │ Tue 10 Nov               │
 │ │ description                               │ │ │ [09:00] [11:30]          │
 │ │ ✓ included 1  ✓ included 2  ✓ included 3  │ │ │ See all times →          │
 │ │ ▸ What to expect  ▸ Questions I can help  │ │ │ ───────────────────────  │
 │ │ Free cancellation up to 24 hours before   │ │ │ €60 total · 60 min       │
 │ │                        [ See times ]      │ │ │ No account needed        │
 │ └───────────────────────────────────────────┘ │ │ Free cancellation up to  │
 │ Training and credentials  (as shared by …)    │ │ 24 hours before          │
 │ ▸ Booking with Eleva  (collapsed, last)       │ └──────────────────────────┘
 └───────────────────────────────────────────────┘
```

- **Hero band**: the portrait is the largest element (4:5, `rounded-4xl`,
  up to 380 px; on phones capped at `50svh` so the name stays above the fold).
  Without a photo: the soft monogram frame from the directory. The headline
  is the expert's own one-liner; under it, the first credential (title,
  institution) when there is one and the headline does not already say it. Facts are **one quiet line**, written in
  full words (languages, how they meet with city, countries). Social links
  are 44 px icon buttons with names ("Patrícia Mota on Instagram"). The hero
  has **one action, "Share this page"**: Web Share API (feature-detected
  after hydration; `AbortError` ignored), else copy link + toast "Link
  copied". Booking lives in the sticky card, so the hero does not repeat it.
- **About me**: rich bio (sanitized `bioRich` HTML, plain `bio` fallback).
  The server decides by text length whether a "Read more" is needed (no
  client measuring, no layout shift); the toggle is a React Aria
  `Disclosure` with `aria-expanded`, focus stays on it, no height animation
  with reduced motion.
- **How I can help**: one card per bookable service: format eyebrow ("60-min
  video call", "45-min in person · Madrid"), title, description, price
  ("€60", "Free"), up to three "What's included" items (rest behind "See
  all"), "What to expect" and "Questions I can help with" as disclosures,
  cancellation in plain words from the policy, a "See times" link to the
  funnel. Request-to-book services add "Patrícia Mota confirms each request
  within 24 hours, or before the session if sooner."
- **Training and credentials**: a quiet timeline (year · title ·
  institution), no caption. Hidden when empty. Who checked what is said once,
  in "Booking with Eleva" (below).
- **Booking with Eleva** (collapsed `Disclosure`, last): how booking works in
  four steps, and short answers: do I need an account (no), how do I join
  (from your email, from 15 minutes before), can I cancel (when: per service
  policy; how: sign in with the email you booked with and cancel from your
  session), who provides my care ("Patrícia Mota provides your care. Eleva
  hosts the booking and the video call."), what Eleva checks ("Before a
  profile goes live, our team checks the expert's professional registration.
  Experts describe their own training and experience.").
- **Booking card** (sticky `lg:top-24`; time links ≥ 44 px tall): the heading "Book a session";
  service picker (compact radio rows, one line each, any number of services);
  "Times in {zone} time"; the next six times for the chosen service grouped
  by day. Times for **every** service are fetched on the server, so
  switching service needs no request; only the picker is client code. Each
  time opens the funnel on the **Confirm** step with that time pre-picked
  and a "Change" link back to the calendar. "See all times" opens the
  calendar. Footer: "€60 total · 60 min", "No account needed", the
  cancellation line.
- **Empty states**: no bookable services → no booking card, and in its place
  "Patrícia Mota isn't taking bookings here yet. See their work below." (PT:
  "Patrícia Mota ainda não tem marcações abertas aqui. Conheça abaixo o
  trabalho de Patrícia Mota."). Services but no times in two weeks → "The next two weeks are
  full" + "See later dates".

### Mobile

Portrait, name, headline, credential, facts, social, Share; then "How I can
help", the booking card, About me, credentials, Booking with Eleva. A sticky
bottom bar shows "From €45" and a "See times" link (`href="#book"`, lands on
the booking card heading with `tabIndex=-1`, works without JS). The bar is
removed from the tab order (`inert`) and hidden while the booking card is on
screen, and the page sets `scroll-padding-bottom` to the bar height plus
`env(safe-area-inset-bottom)` so the bar never covers focused content.

### Share and SEO

- Canonical and hreflang as today; Open Graph uses the portrait. JSON-LD
  `Person` with `jobTitle`, `knowsLanguage` and `sameAs`. No ratings markup.
- The dynamic OG image and share kit are slice 5.

### Content quality

- Fixture copy ("Reference offer fixture.", "Demo seed profile…") never
  reaches a public page: seed headlines and bios read like real experts.
- `patimota` (empty-profile demo, no offers) gets Patrícia Mota's public bio,
  credentials and links from patriciamota.com and ORCID, with her written OK
  on file before production use (founder request 2026-11-07). Never publish
  her personal email.

## 3. Booking funnel (`/{username}/{eventSlug}`)

The stepper lists only the steps this booking has, all labelled from the
start: **How you'll meet** (only when there is a real choice) → **Pick a
time** → **Confirm**.

### Pick a time

```
 STEP 1 OF 2 · PICK A TIME
 Pick a time                                   ┌ summary card ────────┐
 First visit · 60 min · Video · €60            │ (FM) Fisio Mota      │
                                               │ First visit          │
 Times in Lisbon time · Change time zone       │ Video · 60 min       │
 [📅 Next available: Mon 9 Nov, 09:00]         │ Pick a time          │
                                               │ €60 total            │
  ←  November 2026  →                          │ Free cancellation    │
  Mo Tu We Th Fr Sa Su                         │ up to 24 h before    │
  (9) 10 11 12 13  ·  ·                        └──────────────────────┘
   •  •  •  •  •
 Monday, 9 November
 MORNING     [09:00] [09:30] [10:00] [10:30] [11:00] [11:30]
 AFTERNOON   [12:00] [12:30] [13:00 ✓]
             [ Continue with Mon 9 Nov, 13:00 → ]   (full-width row)
```

- **Calendar = React Aria `Calendar`** with `isDateUnavailable`: one tab
  stop, arrow keys (unavailable days take focus but cannot be selected),
  PageUp/PageDown for months, week start from the locale, available days bold
  with a dot, no counts, `gap-0` so 7 × 44 px fits a 328 px column. The
  Month/Week toggle is removed. It opens on the first day with open times,
  with that day's times showing; pressing a day selects the day only, never a
  time.
- **Time zone**: one line "Times in {city} time · Change time zone"
  (accessible name "Change time zone, currently Lisbon"). Change reveals a
  searchable `ComboBox` (city and UTC offset), focus moves into it and
  returns to the trigger on close. Changing zone keeps the chosen time when
  it still exists.
- **Next available** (calendar icon, no urgency styling) selects the earliest
  slot, moves focus to that time and announces "Monday 9 November, 13:00
  selected". This is the one focus move: the member asked for it.
- **Times** are grouped Morning / Afternoon / Evening, 44 px tall with a
  visible edge, on a 24-hour clock everywhere (revised 2026-11-09: the
  browser's hour cycle showed "2:30 p.m." in the funnel and "14:30" on the
  profile card for the same slot). Dates use the EU locales in
  `@eleva/config/i18n` (`intlLocales`). After a day press on phones, the
  times scroll into view.
- **Continue** appears as its own full-width row right after the row holding
  the selected time (desktop) and as a sticky bottom action bar (phones). It
  keeps `booking-continue-when`. Selecting a time never moves focus; a polite
  live region announces the selection. Enter/Space only select.

### Confirm (details + payment on one page)

```
 STEP 2 OF 2 · CONFIRM
 Confirm and pay              (free: "Confirm your booking";
                               approval: "Request to book")
 ① Your session  Mon 9 Nov, 13:00 (Lisbon) · Video · 60 min   Change
 ② Your details
    Full name   [                         ]
    Email       [                         ]
                Your confirmation and join link go here.
                (on blur: "Did you mean ana@gmail.com?")
    Phone       (phone sessions only) "Fisio Mota will call this number."
    + Tell Fisio Mota what you'd like help with (optional)
        Fisio Mota reads this before your session.
        For urgent help, call 112.
    + Need an invoice with your NIF? (paid only)
        We save it with your booking for the invoice.
 ③ Cancellation
    Free cancellation until Sun 8 Nov, 13:00 (Lisbon time).
    After that, the €60 isn't refunded, because this hour is kept for you.
    (Moderate: the partial-refund line and its date)   See full policy ▾
 ④ Before you book
    [ ] I consent to Fisio Mota, with Eleva's help, using the health
        information I share before and during my sessions to provide my
        care. I can withdraw this in Privacy settings.
        How we protect your health data ↗
    [ ] I'm 18 or older, I'm booking for myself, and I agree to the terms
        of use. I've read the privacy notice.   Terms ↗  Privacy ↗
    [ ] Optional: allow live transcription and AI-assisted notes in this
        session. Fisio Mota still writes your report. You can change this
        any time in Privacy settings.   AI processing notice ↗
 [ Continue to payment ]     (free: "Confirm booking"; approval: "Send request")
 🔒 We hold your time while you pay. Payment is secure and handled by Stripe.
 ───────── after the hold ─────────
 ② collapses to "Ana Silva · ana@email.com"  Edit
 ⑤ Payment   (heading receives focus; Stripe Payment Element, space reserved)
    We're holding this time for you · 9:42
 [ Pay €60 ]
```

- **Fields**: name and email required; phone only for phone sessions; note
  and NIF behind React Aria `Disclosure`s that open by default when they hold
  a value and open on a validation error. `autocomplete` `name`, `email`,
  `tel`. Validation runs on blur and on submit, never while typing. On submit
  with errors, focus moves to the first invalid field; every error sits next
  to its field or checkbox (`aria-describedby`) and says what to do.
- **Email typo hint** on blur for common domains (gmail, hotmail, outlook,
  icloud, sapo, yahoo): a one-press suggestion, never auto-corrected.
- **Consents** (④): health-data processing stays its own unticked checkbox
  and record (GDPR art. 9) with scope and withdrawal in the label. Terms,
  privacy notice and the adults-only declaration are one unticked checkbox
  that records the `terms`, `privacy` and `adult_confirmation` grants with
  their current document versions (all three are acknowledgements, not
  art. 9 consent). The AI opt-in stays separate, optional and unticked. Links
  sit outside the `<label>`, referenced with `aria-describedby`, always
  underlined, open in a new tab with that said. DPO confirmation of the
  merged row is required before production and is logged in
  `decision-log.md`, not claimed as done.
- **Cancellation** lines come from `cancellationDeadlines()` /
  `describeCancellationDeadlines()` for the tier, always with the time zone.
- **Price** is shown as a total everywhere ("€60 total") because nothing is
  added at payment; a promo shows as a discount line.
- **Edit after the hold**: "Edit" asks first ("Editing your details
  releases this time. We'll try to hold it again when you continue."), then
  focuses Full name. Continuing re-holds the same time at once; if it has
  gone, the nearest open times show inline instead of the full calendar.
- **Hold**: after "Continue to payment" the details collapse, the Payment
  heading takes focus and scrolls into view, and the Payment Element's space
  is reserved to avoid a jump. The hold ring is quiet; at **2 minutes left**
  (`HOLD_WARNING_MS` = 120 s) it turns amber, a polite live message says
  "2 minutes left to pay. Need more time?" and the existing **Extend**
  button (#317) appears. Expiry offers "Pick a new time" and keeps the
  details. The ticking timer itself is never a live region and is
  `aria-hidden` inside any button; the summary bar's accessible name is
  steady ("Booking summary, about 9 minutes left", updated once a minute).
- **Payment methods**: Apple Pay, Google Pay and MB WAY stay enabled inside
  the Payment Element until the Express Checkout Element (slice 7).
- **Request to book**: "You pay now. If Fisio Mota declines or doesn't reply
  within 24 hours (or before the session, if sooner), you get a full refund."
- **Summary**: desktop sticky card (expert, service, how you meet, date and
  time with zone and duration, cancellation line with date, total, hold
  ring). Phones: a collapsed top bar "Fisio Mota · Mon 9 Nov, 13:00 · €60 ·
  9:42" that is a disclosure button (`aria-expanded`), with
  `scroll-padding-top` so it never covers a focused field; the primary button
  sits in a sticky bottom bar with the price, with `scroll-padding-bottom`
  (bar height plus safe area). Both bars drop back into the page flow while a
  text field has focus, so the phone keyboard never hides the field.
- **Consent rows** keep the same legal wording but set the link and the
  withdrawal sentence on a smaller secondary line, so the labels read
  lighter.

## 4. Thank-you page (Airbnb-style)

```
          (FM)(A)                               overlapping avatars
     You're booked, Ana!                         (display serif)
     Fisio Mota has your booking. A confirmation is on its way
     to ana@email.com.

 ┌──────────── session card ───────────────┐ ┌──── what happens next ───────┐
 │ MONDAY                                   │ │ 1 Now     Confirmation email  │
 │ 9 November · 13:00–14:00                 │ │ 2 Day before  Reminder        │
 │ Lisbon time · in 2 days                  │ │ 3 12:45   Your join link opens│
 │ ─────────────────────────────            │ │ 4 13:00   Your session        │
 │ (V) Video call                           │ └──────────────────────────────┘
 │ Join from the link in your email, from   │ ┌──── prepare ─────────────────┐
 │ 15 minutes before. No account needed.    │ │ What to expect (from service) │
 │ [ Google Calendar ↗ ] [ Apple / Outlook ]│ │ • …                           │
 │ First visit · €60 paid                   │ └──────────────────────────────┘
 │ Free cancellation until Sun 8 Nov, 13:00 │
 └──────────────────────────────────────────┘
 Fisio Mota provides your care; Eleva hosts your booking and the video call.
 If you need urgent help, call 112.
 ┌──────── keep everything in one place ─────────────────────────────────────┐
 │ Create your free Space: your sessions and payments in one place, and      │
 │ faster booking next time.        [ Create my Space ]  (prefilled /signup)  │
 └───────────────────────────────────────────────────────────────────────────┘
                     ← Back to Fisio Mota's page
```

- The hold countdown disappears the moment the booking confirms; all actions
  show at once (no delay). The heading takes focus.
- **Session card**: weekday, date, start–end, time zone, and "in 2 days"
  computed in the browser with `Intl.RelativeTimeFormat`; how to join (video:
  link from 15 minutes before, no account; phone: masked number; in person:
  address with a map link); **Google Calendar** template link (opens a new
  tab, said in its name) and **Apple / Outlook (.ics)**. Calendar entries are
  titled "Session with Fisio Mota": the service name, which can reveal health
  information, stays out of third-party calendars.
- **What happens next**: an `<ol>` timeline with the member's email.
- **Prepare**: the service's "What to expect" items, else a caring fallback
  (a quiet private place, test camera and sound, write down your questions).
- **Who provides care** line with 112, as above.
- **Space signup** after the booking only, prefilled, promising only what
  exists ("your sessions and payments in one place, and faster booking next
  time").
- **Change or cancel, now** (until the slice 6 manage link): confirmation
  attaches the booking to an account under the booking email
  (`guest-activation`), and the member app's session page can cancel it.
  So the session card says how, not only when: "Need to cancel? Sign in with
  ana@email.com and cancel from your session. Free until Sun 8 Nov, 13:00
  (Lisbon time); refunds reach your card in 5–10 days." The confirmation
  email carries the same line (slice 3).
- **Variants**:
  - Request: "Request sent. Fisio Mota replies within 24 hours (or before
    the session, if sooner). You've paid €60; if Fisio Mota can't take it,
    you get a full refund. Join details arrive once accepted."
  - Payment settling (409 `PAYMENT_PENDING`): "Payment received. We're
    confirming your session; the email arrives within a few minutes. Please
    don't pay again."
  - Confirm failed: the existing retry, with "You won't be charged twice."
- A one-time check-draw animation; none with reduced motion.

## 5. Voice

- Second person, plain words, "members". The expert is named in full
  ("Fisio Mota") until slice 4 adds "What members call you"; never the first
  word of a display name. Until slice 4 stores how the expert wants to be
  addressed, no template assumes a gender: EN "their", PT/ES repeat the name
  instead of "dela"/"ela"/"la experta".
- PT is European Portuguese, formal third person ("o seu", "para si"), never
  "tu". ES uses "tú". No HIPAA, no claims about what Eleva lacks, no speaking
  for the expert ("looking forward to meeting you" only when the expert
  wrote it, slice 4).

## 6. Quality bar (all surfaces)

- WCAG 2.2 AA: 44 px targets, visible focus not obscured by sticky bars
  (2.4.11), focus moves to each step heading, live regions only for
  meaningful changes, errors linked with `aria-describedby`, text contrast
  ≥ 4.5:1, control edges ≥ 3:1, links distinguishable without colour.
- React Aria vocabulary, `@eleva/icons`, `@eleva/ui` tokens; no new colours.
- Profile and directory stay Server Components; only the share button, bio
  toggle, booking-card picker and mobile bar are client code.
- e2e test ids stay stable (`booking-*`, `profile-upcoming-slot`,
  `expert-profile-heading`).

## Slices

1. **Directory and profile** (§1, §2) on existing data.
2. **Pick a time** (§3 first half): `SlotPicker` on React Aria `Calendar`,
   time-zone ComboBox, grouped times.
3. **Confirm and thank-you** (§3 second half, §4), including the merged
   consent row (DPO confirmation logged as pending).
4. **Profile content fields** (migration, API, OpenAPI, audit, expert
   editor): "What members call you", "Who I work with" (up to three lines),
   a personal welcome message (thank-you page and confirmation email),
   professional registration shown as a plain fact when the expert opts in
   ("Registered with Ordem dos Fisioterapeutas · nº 12345"), "Where you may
   know me from" (publications, teaching, talks, media as links), years in
   practice; `patimota` seed with her public record.
5. **Share kit**: dynamic OG image, QR, "Book with me" button in the expert
   app.
6. **Guest self-service and availability**: a signed manage link for guests
   (change or cancel without signing in; until then, the sign-in route in §4) in the confirmation email and on
   the thank-you page; "Next: Mon 9 Nov" on directory cards once an
   availability cache exists (computing calendar busy times per expert on
   every directory render would breach the public rate budget).
7. Later: post-session reviews; session packs and monthly plans (terms
   first); intro video; Stripe Express Checkout Element; funnel analytics.

## Out of scope

- Ratings, review counts, "Top Expert" or verification badges on profiles.
- Gift cards; packs, plans and subscriptions to an expert.
- Moving the terms row to "by confirming" small print without a checkbox
  (needs a DPO decision).
