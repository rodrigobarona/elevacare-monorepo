# 00 — Entry and address

Pre-wizard steps before the 3-phase listing wizard. Host chooses **what** to list, then anchors the listing to a **physical address**.

[← Hub](../readme.md) · Next: [01 — About your space](01-phase-about-your-space.md)

---

## Step 1 — Listing type modal

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.28.32.png` |
| Timestamp | 09:28:32 |
| Screen type | modal (overlay on host dashboard) |
| Primary CTA | Próximo (Next) |
| Next enabled when | One of three listing categories is selected |

**Goal:** Route the host into the correct onboarding flow (accommodation vs experience vs service).

**Context (background):** Host dashboard (`Hoje` tab) is dimmed. User already has at least one listing (`Tem 1 reserva agendada`).

**UI elements:**

- Modal title: **O que gostaria de anunciar?** *(What would you like to list?)*
- Three large selectable cards (icon + label):
  1. **Alojamento** *(Accommodation)* — house with tree illustration
  2. **Experiência** *(Experience)* — hot air balloon illustration
  3. **Serviço** *(Service)* — hotel bell illustration
- Close **X** (top right of modal)
- Footer: **Próximo** — disabled (grey) until selection

**Copy (PT):**

- O que gostaria de anunciar?
- Alojamento · Experiência · Serviço
- Próximo

**Validation / gating:**

- No default selection; **Próximo** stays disabled until user taps a card
- This walkthrough continues with **Alojamento**

**UX notes:**

- **Early flow fork** — different products never share the same wizard
- Modal on existing dashboard preserves context (user can cancel without leaving host area)
- Visual 3D-style icons make categories scannable without reading

![Step 1](../Screenshot%202026-05-22%20at%2009.28.32.png)

---

### Step 2 — Create listing landing

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.28.48.png` |
| Timestamp | 09:28:48 |
| Screen type | full-page landing |
| Primary CTA | Address search field (implicit — type to proceed) |
| Next enabled when | Address entered / selected from autocomplete (not shown in screenshot) |

**Goal:** Collect the property address as the first substantive input after choosing accommodation.

**UI elements:**

- Airbnb logo (top left)
- **Split layout:** copy left, aspirational photo right
- Heading: **Crie o seu anúncio na Airbnb** *(Create your listing on Airbnb)*
- Subheading: **É fácil criar um anúncio de excelência – vamos começar pela sua morada.** *(It's easy to create an excellent listing – let's start with your address.)*
- Pill-shaped search input with magnifying glass icon
- Placeholder: **Insira o seu endereço** *(Enter your address)*
- Hero image: luxury outdoor pool/patio (rounded corners) — motivational, not user's property yet

**Validation / gating:**

- Address is the entry point; no progress bar yet (pre-wizard)

**UX notes:**

- **Address-first** reduces abandonment later (location drives comps, regulations, map)
- Aspirational imagery sets quality bar before any form fatigue
- Single field = low friction start

![Step 2](../Screenshot%202026-05-22%20at%2009.28.48.png)

---

### Step 3 — Landing with preview card

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.29.00.png` |
| Timestamp | 09:29:00 |
| Screen type | full-page landing (same as step 2, preview visible) |
| Primary CTA | Address search field |
| Next enabled when | Address provided |

**Goal:** Same as step 2; shows **live preview** of what a finished listing card looks like.

**UI elements:**

- Same left column as step 2
- Right side: light blue rounded container with **mock listing card**
  - Photo: colorful Victorian row houses (San Francisco)
  - Title: **Entire condo in San Francisco, California**
  - Footer: **Hosted by Stephanie** + avatar

**Validation / gating:** Same as step 2.

**UX notes:**

- **Outcome preview** before work begins — classic conversion pattern
- Preview is generic (not geo-matched to typed address in this capture)
- Reinforces mental model: "you are building this card"

![Step 3](../Screenshot%202026-05-22%20at%2009.29.00.png)

---

### Step 4 — Confirm address modal

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.29.36.png` |
| Timestamp | 09:29:36 |
| Screen type | modal (over address landing) |
| Primary CTA | Próximo (Next) |
| Next enabled when | Required fields valid (all shown fields populated in capture) |

**Goal:** Let host verify and edit parsed address components before entering the multi-step wizard.

**UI elements:**

- Modal title: **Confirme o seu endereço** *(Confirm your address)*
- Back arrow (top left) · Close X (top right)
- Form fields (stacked):
  - **País/região** *(Country/region)* — dropdown, value: `Portugal - PT`
  - **Nome da rua** *(Street name)* — `Largo Prof. José Bernardo Cotrim 35`
  - **Apartamento, suíte, unidade (se aplicável)** *(Apt/suite/unit if applicable)* — empty
  - **Código postal** *(Postal code)* — `2240`
  - **Cidade/vila** *(City/town)* — `Nossa Senhora do Pranto`
- Full-width dark button: **Próximo**

**Copy (PT):** Confirme o seu endereço · field labels above · Próximo

**Validation / gating:**

- Autocomplete from step 2 pre-fills fields; user can correct before wizard starts
- Optional unit field does not block progress

**UX notes:**

- **Human-in-the-loop** for geocoding errors (critical for rural PT addresses)
- Modal keeps user on landing context; back arrow returns to search
- After confirm → wizard Phase 1 begins

![Step 4](../Screenshot%202026-05-22%20at%2009.29.36.png)

---

## Chapter summary

| Step | Collects | Blocks until |
|------|----------|--------------|
| 1 | `listing_category` = accommodation \| experience \| service | Category selected |
| 2–3 | Address query | Address entered |
| 4 | Structured address (country, street, unit, postal, city) | User confirms |

**Next:** [01 — About your space](01-phase-about-your-space.md) (Passo 1 wizard)
