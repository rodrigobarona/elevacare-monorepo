# Expert Profile and Booking UX Spec (v3)

Status: proposed (founder review 2026-10-19)

## Goal

Members book online and pay upfront. The public expert profile and the booking
flow must give the same confidence as Airbnb or Uber: who the expert is, what
the session includes, exactly when it happens, what it costs and what happens
if plans change, visible at every step.

References: the old eleva-care-app profile (`_context/clone-repo/eleva-care-app`,
big portrait, verified name, headline, categories, social links, long bio) and
[intro.co](https://intro.co) (portrait column, offer cards with "What's
included", "What to expect" and "Example questions").

## Founder decisions (2026-10-19)

- Layout: two columns in the intro / old-app direction, but a clearly better
  design than today's profile.
- New expert content: social links, rich bio, per-service "What to expect" and
  "What's included", per-service "Example questions", credentials and
  education.
- Trust: no stars, counts or badges until there is real data. A post-session
  reviews feature is planned as a later slice.
- Session packs and monthly plans: a later phase, after the founder sets the
  commercial terms. The profile layout reserves a place for them; nothing is
  built or shown now.

## Profile

Desktop, two columns:

- Left column (about the person, scrolls normally):
  - large portrait (4:5) with an initials fallback that still fills the frame;
  - display name, headline, categories;
  - facts row: languages, where they see members, how they meet (video, phone,
    in person with city);
  - social links as icon buttons;
  - "About" rich bio (headings, lists, links), collapsed after a few
    paragraphs with "Read more";
  - credentials and education list.
- Right column (the booking column, sticky on desktop):
  - one card per service: title, duration, how you meet, price ("From" only
    when modes differ), cancellation rule in plain words, the next available
    time for that service, primary "See times" button;
  - "What's included" bullets on the card (first three, "See more");
  - reserved slot for packs and plans (not rendered until that phase).
- Below both columns: per-service "What to expect" and "Example questions"
  (accordion, one section per service), then "How booking works" (choose a
  time, add your details, pay securely, join from your email) with the refund
  rule.

Mobile: portrait, name and facts first, then the service cards, then the bio.
A bottom bar shows the lowest price and "See times".

## Booking flow

- Steps stay the same (how you'll meet, when, your details, payment,
  confirmed), but the full list is shown from the start with labels, so the
  count never jumps. The "how you'll meet" step is shown as done when it is
  inferred.
- The summary card builds up as the member advances: expert and service, how
  you meet (with the city for in person), the exact date and time with the
  time zone, the duration, the price (VAT note), and the cancellation rule as
  a real date ("Free cancellation until Mon 19 Oct, 09:00").
- Details step: contact fields first, then "For your invoice" (tax ID) and
  "Promo code" collapsed, then intake notes, then consents.
- Payment step: repeats the total, the hold timer, the refund date and a
  secure payment note above the Stripe element. "You'll get a confirmation
  email with the join link" sets expectations.
- Confirmation: unchanged structure (Airbnb-style), no delays.

## Data and API changes

- `expert_profiles`: `social_links` (validated list of `{ kind, url }`, kinds:
  instagram, linkedin, website, youtube, tiktok, facebook), `credentials`
  (list of `{ title, institution?, year? }`), rich bio (Plate JSON with
  server-derived sanitized HTML and plain text; the plain text keeps feeding
  search).
- `event_types`: localized `whats_included`, `what_to_expect` and
  `example_questions` (lists of short localized strings).
- Public API `GET /public/experts/{username}` exposes the new fields; expert
  API `PATCH /expert/profile` and the event-type update accept them, with Zod
  schemas registered in OpenAPI and writes wrapped in `withAudit()`.

## Expert app

- New "Public profile" page: photo, display name, headline, rich bio, social
  links and credentials, with a link to the public page. Today experts can only
  set the basics during setup.
  - Photo: uploaded to the public Blob store under `expert/portrait/`, 4:5
    preview, JPG/PNG/WebP up to 5 MB. Replacing it deletes the old file. The
    account avatar (`user.image`, possibly an OAuth picture) is never used.
  - Bio: the expert picks the language they write in. Other languages can be
    filled by "Translate from …" (`POST /ai/editor`, command `translate`); the
    result is stored as `ai_draft` until the expert edits that tab.
- Service editor: a "Details" tab for "What to expect", "What's included" and
  "Questions you can help with" (stored as `exampleQuestions`), per language.
  Empty lists are hidden on the public page.

## Content from v2 (inspiration, not copy)

The v2 MDX content (`_context/clone-repo/eleva-care-app/src/content`, same as
the `clerk-workos` branch) is a source of structure and tone. Every number,
policy, badge and audience noun is rewritten against v3 facts.

- Profile editor hints (from `help/expert/*/getting-started/profile.mdx`):
  - Bio in four beats: what you do and for whom, how you work, training,
    why this work. Written in the first person.
  - Photo tips next to the upload: recent headshot, natural light, plain
    background; no group photos, heavy filters or logos.
  - Credentials: title, institution, year; list only training you can show.
  - Only list areas of care you are qualified for.
- Service "Details" hints (from `getting-started/services.mdx`): a clear
  title rather than "Session 1"; what happens, who it is for, what the
  member leaves with, how to prepare. These map to "What's included",
  "What to expect" and "Example questions".
- Member "How booking works" (from `help/patient/*/booking.mdx`, rewritten):
  choose a service and time; add details (no account needed); pay securely
  or confirm a free session; join from the confirmation email, with the
  waiting room opening the call 15 minutes before the start. Request to Book
  services say the expert confirms first.
- Must not carry over: commission percentages and plan prices, the flat
  24-hour refund grid (v3 uses Flexible/Moderate/Strict per service), star
  ratings and Top Expert benefits, HIPAA/BAA or certification claims,
  "account required to book", "join 5 minutes before", payout timing,
  session packages, "automated invoicing", the word "patients" in member
  copy, and "Workspace" for personal Spaces.
- Content track (founder 2026-10-19: bring it all, adapted to today's
  product; v2 was early thinking and nothing in it is mandatory), one PR per
  surface after slice 4: richer Become an expert and For clinics pages, a
  member and expert help center on the website, an evidence-based care
  page, and fuller legal and trust drafts. All stay marked as drafts; legal
  and trust text still needs legal and DPO review.

## Slices

1. Data and API: migration, Zod schemas, OpenAPI, audit, public and expert
   endpoints.
2. Expert "Public profile" page and the service editor "Details" tab.
3. Public profile redesign. Also drop the experts directory "Rating" sort,
   which has no data behind it.
4. Booking flow confidence pass (fixed step list, richer summary, details
   grouping, payment recap).
5. Later: post-session reviews; session packs and monthly plans (separate
   phase, terms first).

## Out of scope

- Ratings, review counts, "Top Expert" or verification badges.
- Gift cards.
- Packs, plans, subscriptions to an expert.
