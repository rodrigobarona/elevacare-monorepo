# 03 — Phase 3: Finish and publish

**Passo 3 — Conclua o seu anúncio e publique-o.** Pricing, promotions, safety disclosures, and **Criar anúncio** (create listing).

[← 02 Stand out](02-phase-stand-out.md) · [Hub](../readme.md) · Next: [04 — Post-creation compliance](04-post-creation-compliance.md)

**Progress bar:** Segment 3 of 3 active from step 22.

---

### Step 22 — Passo 3 interstitial

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.36.03.png` |
| Timestamp | 09:36:03 |
| Screen type | interstitial |
| Primary CTA | Seguinte |

**Goal:** Introduce final phase — nightly price, quick questions, publish.

**UI elements:**

- **Passo 3** · **Conclua o seu anúncio e publique-o**
- Body: set price per night, answer quick questions, publish when ready
- Illustration: modern house with solar panels, skylights, garden
- Progress: segments 1–2 complete; segment 3 started

![Step 22](../Screenshot%202026-05-22%20at%2009.36.03.png)

---

### Step 23 — Weekday base price

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.36.12.png` |
| Timestamp | 09:36:12 |
| Screen type | wizard (price input) |
| Primary CTA | Seguinte |

**Goal:** Set base nightly rate for weekdays.

**UI elements:**

- Title: **Agora, defina um preço base para os dias úteis** *(Set a base price for weekdays)*
- Suggestion: **€ 140** — weekend price comes next
- Large display: **€140** (editable)
- **Preço do/a viajante: € 160** — guest-facing price after fees (expandable)
- Button: **Ver anúncios semelhantes** *(See similar listings)* — opens comps map
- Link: **Saiba mais sobre os preços**

**Data in capture:** Host €140 → Guest €160 (fee transparency).

![Step 23](../Screenshot%202026-05-22%20at%2009.36.12.png)

---

### Step 24 — Similar listings map

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.36.31.png` |
| Timestamp | 09:36:31 |
| Screen type | overlay (fullscreen map modal) |
| Primary CTA | Close X → return to pricing |
| Next enabled when | Modal dismissed |

**Goal:** Market comparison to calibrate price.

**UI elements:**

- Map modal: **Comparar com anúncios semelhantes**
- Filter: **Casa/apartamento inteiro · 2 a 6 quartos**
- Date range: May 20, 2025 – May 20, 2026
- Panel: **Anúncios reservados** — most booked listings in range averaged **€65–€954**/night
- Map bubbles: competitor prices (€65–€516 etc.)
- User listing pin: **€140** (red, house icon)
- Google Maps attribution

**UX notes:** Data-driven pricing confidence without leaving onboarding.

![Step 24](../Screenshot%202026-05-22%20at%2009.36.31.png)

---

### Step 25 — Weekend price supplement

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.36.43.png` |
| Timestamp | 09:36:43 |
| Screen type | wizard (slider) |
| Primary CTA | Seguinte |

**Goal:** Add Fri/Sat premium as percentage on base price.

**UI elements:**

- Title: **Defina um preço de fim de semana** *(Set a weekend price)*
- Subtitle: supplement for Fridays and Saturdays
- Large price: **€147** (host earnings at 5% supplement on €140)
- **Preço do/a viajante: € 168**
- Slider: **Suplemento de fim de semana** — 0% to 99%, suggestion try 5%
- Input shows **5%**

**Math in capture:** €140 × 1.05 ≈ €147 host; guest €168.

![Step 25](../Screenshot%202026-05-22%20at%2009.36.43.png)

---

### Step 26 — Discounts

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.36.56.png` |
| Timestamp | 09:36:56 |
| Screen type | wizard (checkbox list) |
| Primary CTA | Seguinte |

**Goal:** Opt into launch discounts (all pre-checked in capture).

**UI elements:**

- Title: **Adicionar descontos** *(Add discounts)*
- Subtitle: stand out, book faster, get first reviews
- Four cards (checkbox right, all checked):
  | % | Name | Rule |
  |---|------|------|
  | 20% | Promoção para novos anúncios | First 3 bookings |
  | 10% | Desconto para reservas de última hora | Booked ≤14 days before |
  | 10% | Desconto semanal | 7+ nights |
  | 20% | Desconto mensal | 28+ nights |
- Footnote: **Só se aplica um desconto por estadia.** Saiba mais

**UX notes:** Pre-checked = opt-out model to accelerate early bookings.

![Step 26](../Screenshot%202026-05-22%20at%2009.36.56.png)

---

### Step 27 — Discounts help modal

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.37.05.png` |
| Timestamp | 09:37:05 |
| Screen type | modal (help) |
| Primary CTA | Dismiss X |

**Goal:** Explain discount rules and regional suggestions.

**UI elements:**

- Title: **Descontos**
- Body: change anytime; suggestions based on regional averages; weekly = 7+ nights, monthly = 28+ nights
- Link to Help Center discounts section
- Background discounts screen dimmed

![Step 27](../Screenshot%202026-05-22%20at%2009.37.05.png)

---

### Step 28 — Safety disclosures

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.37.15.png` |
| Timestamp | 09:37:15 |
| Screen type | wizard (compliance checklist) |
| Primary CTA | **Criar anúncio** (not Seguinte) |
| Header | Sair only (no Save and exit / Have questions) |

**Goal:** Legal/safety attestations before listing creation.

**UI elements:**

- Title: **Partilhe informações de segurança** *(Share safety information)*
- Question: **Tem alguma destas coisas no seu espaço?** (info icon)
- Checkboxes (all empty in capture):
  - Outdoor security camera
  - Noise decibel monitor
  - Weapons on property
- Section **O que é important saber:**
  - No indoor cameras (even off)
  - Must disclose outdoor cameras to guests
  - Local laws + Non-discrimination policy + fee links
- **Criar anúncio** button (terminal CTA rename)

![Step 28](../Screenshot%202026-05-22%20at%2009.37.15.png)

---

### Step 29 — Outdoor camera detail modal

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.37.31.png` |
| Timestamp | 09:37:31 |
| Screen type | modal (conditional) |
| Primary CTA | Continuar |
| Next enabled when | Description text entered |

**Goal:** If outdoor camera checked, require monitored-area description.

**UI elements:**

- Title: **Informe os hóspedes da existência de câmaras de segurança no exterior**
- Instruction: describe each camera's area (yard, pool, etc.) · Saiba mais
- Textarea · **300 caracteres disponíveis**
- **Continuar** disabled until input

**UX notes:** Conditional sub-flow keeps main form short.

![Step 29](../Screenshot%202026-05-22%20at%2009.37.31.png)

---

### Step 30 — Safety completed

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.37.49.png` |
| Timestamp | 09:37:49 |
| Screen type | wizard (compliance, filled) |
| Primary CTA | Criar anúncio |

**Goal:** Review safety answers before submit.

**UI elements:**

- Outdoor camera: **checked**
- Inline summary: **Para ver e controlar a piscina** + **Editar**
- Decibel monitor: unchecked
- Weapons: unchecked
- **Criar anúncio** enabled

**Outcome:** Clicking **Criar anúncio** creates listing draft → post-creation gates (chapter 04).

![Step 30](../Screenshot%202026-05-22%20at%2009.37.49.png)

---

## Chapter summary

| Topic | Details |
|-------|---------|
| Weekday price | Base €/night + guest price display |
| Weekend | % supplement on Fri/Sat |
| Discounts | 4 types; one per stay; opt-out defaults |
| Safety | Cameras/weapons/noise; conditional camera copy |
| Terminal action | **Criar anúncio** ends wizard |

**Next:** [04 — Post-creation compliance](04-post-creation-compliance.md)
