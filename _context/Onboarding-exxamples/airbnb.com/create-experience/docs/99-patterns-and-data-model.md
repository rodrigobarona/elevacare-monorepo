# 99 — Patterns and data model

Cross-cutting UX patterns and implied data fields from the Airbnb **Experiência** listing onboarding flow. Use when designing Eleva expert onboarding or similar team-reviewed publish flows.

[← Hub](../readme.md) · See also: [listing-property patterns](../listing-property/docs/99-patterns-and-data-model.md)

---

## Patterns to borrow

| Pattern | Airbnb example | Design intent | Eleva application ideas |
|---------|----------------|-------------|-------------------------|
| **Listing type fork** | Alojamento / Experiência / Serviço (property doc) | Route different products early | Expert vs Team vs Academy vs Space |
| **Category drill-down** | 5 categories → food sub-chips | Taxonomy before wizard | Specialty → sub-specialty before profile wizard |
| **City before wizard** | Search + suggestions modal | Geo context for review/compliance | Practice city before multi-step profile |
| **Team-review intro** | “Equipa irá analisar” + **Comece já** | Set expectation: not instant publish | Expert application review vs self-serve Space |
| **Dark sidebar sections** | 7 modules with icons | Chunk long flow; jump between sections | Chapter nav for expert onboarding |
| **Section progress label** | `Passo N de 7` in header | Local progress within module | Per-chapter step counts |
| **Save and exit** | `Gravar e sair` | Async completion | Draft on all onboarding routes |
| **Field-specific experience years** | Gastronomy years stepper | Copy matches category | Dynamic labels from org type / specialty |
| **Credential cards** | Apresentação / Qualificações / Reconhecimento | Build trust incrementally | Bio blocks with min lengths |
| **Tips modals** | Obter dicas on title/credentials | Reduce blank-field anxiety | Example copy for expert headline |
| **Char limits surfaced** | 40 / 150 / 90 / 50 / 200 / 35 / 30 | No surprise truncation | Inline counters on public text |
| **Internal-only profile links** | LinkedIn — not on listing | Fraud/validation without exposing PII | Verify credentials off-public-profile |
| **Residential vs meeting address** | Home address private; meeting public | Compliance vs guest-facing location | Clinic address vs session location |
| **Hard photo minimum** | 5 unique experience photos | Prevent weak merchandising | Min gallery for expert profile |
| **Itinerary as nested wizard** | Per-activity modal chain | Complex structured content | Session plan / visit steps |
| **Activity cap** | Up to 10 activities | Bound scope | Max phases in a program template |
| **Earnings preview** | €16 → host €13 | Fee transparency | Member price vs platform fee |
| **Private group minimum** | €150 minimum + Saltar | Optional B2B/private pricing | Corporate package floor |
| **Discount modals** | Limited / early bird / large group | Optional promos at launch | Launch offers default-off |
| **Compliance Yes/No block** | Transport, kitchen, alcohol | Regulatory routing | Licensed practice / telehealth flags |
| **Terms gate** | Concordo before review | Legal acceptance | Terms + privacy on submit |
| **Review screen** | Dark **Publicar** + checklist | Final confidence check | Pre-submit summary for expert application |
| **Request publish** | **Pedir para publicar** (not live) | Human review queue | Submit for Eleva review |
| **Status badges** | **Enviado** / **Em curso** | At-a-glance pipeline | Application states on dashboard |
| **Post-submit checklist** | Passos para publicar sidebar | Draft ≠ approved | Onboarding checklist after submit |

---

## Implied data model

### Experience listing (root)

| Field | Type | Collected at | Notes |
|-------|------|--------------|-------|
| `listing_category` | enum | Pre | experience (from global fork) |
| `experience_category` | enum | Step 1 | art, food, sport, history, nature |
| `experience_subcategory` | enum | Step 2 | e.g. gastronomic_tasting |
| `city` | string | Steps 3–4 | Public city label |
| `status` | enum | Post | draft · submitted · under_review · published |
| `title` | string(50) | Step 30 | Public headline |
| `description` | string(200) | Step 32 | Participant-facing summary |

### Host profile (Sobre si)

| Field | Type | Collected at | Notes |
|-------|------|--------------|-------|
| `years_in_field` | int | Step 6 | Category-specific label |
| `professional_title` | string(40) | Steps 8–9 | Apresentação |
| `qualifications` | string(150+) | Step 12 | Min 150 chars |
| `recognition` | string(90)? | Step 13 | Optional milestone |
| `profile_links[]` | url[] | Steps 14–17 | Internal validation |
| `host_residential_address` | Address | Steps 18–19 | Not shared with guests |

### Location

| Field | Type | Collected at | Notes |
|-------|------|--------------|-------|
| `meeting_address` | Address | Steps 20–22 | Shown on listing |
| `meeting_latitude` | number | Step 23 | Map pin |
| `meeting_longitude` | number | Step 23 | |

### Merchandising

| Field | Type | Collected at | Notes |
|-------|------|--------------|-------|
| `photos` | Media[] | Steps 24–28 | min 5; cover_index |
| `itinerary_activities[]` | Activity[] | Steps 33–43 | max 10 |
| `activity.title` | string(35) | Itinerary modal | |
| `activity.description` | string(30+) | Itinerary modal | min 30 |
| `activity.duration_minutes` | int | Itinerary modal | |
| `activity.photo_id` | ref | Itinerary modal | From experience photos |

### Pricing

| Field | Type | Collected at | Notes |
|-------|------|--------------|-------|
| `max_group_size` | int | Steps 44–45 | |
| `price_per_person` | money | Steps 46–49 | Guest price |
| `host_earnings_per_person` | money | Step 48 | After service fee |
| `private_group_minimum` | money? | Steps 51–53 | Optional |
| `discounts[]` | Discount[] | Steps 55–59 | Optional promos |

### Compliance & submit

| Field | Type | Collected at | Notes |
|-------|------|--------------|-------|
| `offers_transport` | boolean | Step 60 | |
| `transport_licensed` | boolean? | Step 60 | If transport yes |
| `serves_food` | boolean | Step 60 | |
| `authorized_kitchen` | boolean? | Step 60 | If food yes |
| `serves_alcohol` | boolean | Step 60 | |
| `terms_accepted` | boolean | Steps 61–62 | |
| `submitted_at` | datetime | Step 63 | Pedir para publicar |

---

## Wizard gating rules (summary)

| Rule | Where | Behavior |
|------|-------|----------|
| Category required | Pre step 1 | Cannot proceed without selection |
| Subtype required | Pre step 2 | Próximo disabled until chip selected |
| City required | Pre steps 3–4 | Próximo disabled until city chosen |
| Credential minimums | Sobre si | 150 chars qualifications; optional recognition |
| Photo minimum | Fotografias | Próximo disabled until ≥5 photos |
| Title/description limits | Experiência | Counters enforce 50 / 200 |
| Activity minimums | Itinerário | 30 char description; duration + photo per activity |
| Price required | Preços | Per-person price before continue |
| Compliance complete | Detalhes | Concordo requires all Yes/No answered |
| Team review | Submit | Listing not live until approval |

---

## Comparison with accommodation listing

| Dimension | Accommodation | Experience |
|-----------|---------------|------------|
| Pre-wizard | Address-first | Category → subcategory → city |
| Progress UI | 3-phase bottom bar | 7-section dark sidebar |
| Publish CTA | Criar anúncio (draft live path) | Pedir para publicar (team queue) |
| Unique blocks | Capacity, amenities, weekend pricing | Credentials, itinerary, compliance Q&A |
| Post-create | Portugal registration gates | Enviado / Em análise checklist |

---
