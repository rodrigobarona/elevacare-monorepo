# 01 — Phase 1: About your space

**Passo 1 — Fale-nos sobre o seu espaço.** Collects structural facts: property taxonomy, booking scope, map location, privacy, and capacity.

[← 00 Entry](00-entry-and-address.md) · [Hub](../readme.md) · Next: [02 — Stand out](02-phase-stand-out.md)

**Progress bar:** Segment 1 of 3 (active throughout this chapter).

---

## Step 5 — Passo 1 interstitial

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.29.58.png` |
| Timestamp | 09:29:58 |
| Screen type | interstitial (phase intro) |
| Primary CTA | Seguinte (Next) |
| Next enabled when | Always (informational only) |

**Goal:** Set expectations for everything in Phase 1 before individual questions.

**UI elements:**

- **Passo 1** label (small grey)
- Heading: **Fale-nos sobre o seu espaço** *(Tell us about your space)*
- Body: explains upcoming questions — property type, entire space vs room, location, max guests
- Right: isometric 3D cutaway house illustration (bedroom, bath, living, dining, loft)
- Top right only: **Gravar e sair** (no "Have questions?" on this screen)
- Bottom: progress bar (segment 1 highlighted) · **Seguinte**

**Copy (PT):**

> Neste passo, vamos perguntar-lhe que tipo de propriedade tem e se os hóspedes podem reservar o espaço inteiro ou apenas um quarto. Em seguida, diga-nos a localização e o número máximo de hóspedes da estadia.

*(In this step we will ask what type of property you have and whether guests can book the entire space or just a room. Then tell us the location and maximum number of guests.)*

**UX notes:**

- **Phase interstitial** — no data collected; reduces surprise in long wizard
- Illustration matches category (home interior)

![Step 5](../Screenshot%202026-05-22%20at%2009.29.58.png)

---

### Step 6 — Property type grid

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.30.09.png` |
| Timestamp | 09:30:09 |
| Screen type | wizard (single-select grid) |
| Primary CTA | Seguinte |
| Next enabled when | One property type selected |

**Goal:** Classify the listing into Airbnb's property taxonomy.

**UI elements:**

- Question: **Quais das seguintes opções descrevem melhor o seu espaço?** *(Which of the following best describes your space?)*
- ~27 cards in a multi-column grid (icon + label), including:
  - Casa, Apartamento, Celeiro, Pousada, Barco, Cabana, Caravana, Casa particular, Castelo, Gruta, Contentor, Casa cicládica, Dammuso, Casa domo, Casa-terra, Quinta, Casa de hóspedes, Hotel, Casa flutuante, Minsu, Riad, Ryokan, Cabana de pastor, Tenda, Minicasa, Torre, Casa na árvore
- Chrome: Tem dúvidas? · Gravar e sair · Anterior · Seguinte (disabled until selection)

**Validation / gating:**

- Single-select; **Seguinte** greyed out with no selection

**UX notes:**

- Large taxonomy exposed upfront (search/filter not shown — scroll implied)
- Icon + label cards scannable on desktop
- Choice affects search filters and guest expectations

![Step 6](../Screenshot%202026-05-22%20at%2009.30.09.png)

---

### Step 7 — Space type selection

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.30.42.png` |
| Timestamp | 09:30:42 |
| Screen type | wizard (single-select cards) |
| Primary CTA | Seguinte |
| Next enabled when | One space type selected (pre-selected in capture) |

**Goal:** Define booking scope — entire place, private room, or hostel-style shared room.

**UI elements:**

- Question: **Que tipo de espaço estará à disposição dos viajantes?** *(What type of space will be available to travelers?)*
- Three vertical cards:
  1. **Um espaço inteiro** *(An entire space)* — "Os viajantes têm o espaço todo só para eles." — house icon — **selected** (thick border)
  2. **Um quarto** *(A room)* — own room + shared spaces — door icon
  3. **Um quarto partilhado num hostel** *(Shared room in a hostel)* — professional hostel, 24/7 staff — bunk beds icon

**UX notes:**

- Descriptions clarify legal/operational model (especially hostel path)
- Selected state = prominent border (not checkbox)

![Step 7](../Screenshot%202026-05-22%20at%2009.30.42.png)

---

### Step 8 — Map pin confirmation

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.30.54.png` |
| Timestamp | 09:30:54 |
| Screen type | wizard (map) |
| Primary CTA | Seguinte |
| Next enabled when | Pin position accepted (always allowed to continue with default) |

**Goal:** Confirm geolocation accuracy on a map.

**UI elements:**

- Title: **O marcador está no local certo?** *(Is the marker in the right place?)*
- Subtitle: **A sua morada só é partilhada com os hóspedes depois de estes terem concluído a reserva.** *(Your address is only shared with guests after they complete a booking.)*
- Google Maps embed with address bar: `Largo Prof. José Bernardo Cotrim 35, 2240, Portugal`
- Black circular pin with house icon
- Tooltip: **Arraste o mapa para reposicionar o marcador** *(Drag the map to reposition the marker)*
- Map zoom controls (+ / − / pan)

**UX notes:**

- **Drag map, not pin** — reduces accidental mis-taps
- Reassurance about address privacy before booking
- Uses Google Maps branding

![Step 8](../Screenshot%202026-05-22%20at%2009.30.54.png)

---

### Step 9 — Location privacy on map

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.31.07.png` |
| Timestamp | 09:31:07 |
| Screen type | wizard (map + toggle) |
| Primary CTA | Seguinte |
| Next enabled when | Toggle set (either state allows proceed) |

**Goal:** Let host choose exact vs approximate map display pre-booking.

**UI elements:**

- Title: **Decida como a localização será apresentada no mapa** *(Decide how the location will be shown on the map)*
- Subtitle: approximate location shown until reservation confirmed
- Same map + address bar as step 8
- Toggle card below map:
  - **Mostrar a localização exata** *(Show exact location)*
  - Description + "Saiba mais" link
  - Toggle **OFF** in capture (approximate location for search)

**UX notes:**

- Separates **pin accuracy** (step 8) from **guest-visible precision** (step 9)
- Default-off protects host privacy in rural/suburban listings

![Step 9](../Screenshot%202026-05-22%20at%2009.31.07.png)

---

### Step 10 — Capacity steppers

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.31.42.png` |
| Timestamp | 09:31:42 |
| Screen type | wizard (numeric steppers) |
| Primary CTA | Seguinte |
| Next enabled when | Values ≥ minimum (defaults shown) |

**Goal:** Capture occupancy and room counts; bed types deferred.

**UI elements:**

- Title: **Partilhe algumas informações sobre o seu espaço** *(Share some information about your space)*
- Subtitle: **Adicionará mais detalhes mais tarde, como tipos de cama.** *(You'll add more details later, such as bed types.)*
- Four rows with − / value / + controls:

  | Label | Value in capture |
  |-------|------------------|
  | Hóspedes (Guests) | 8 |
  | Quartos (Bedrooms) | 4 |
  | Camas (Beds) | 4 |
  | Casas de banho (Bathrooms) | 3 |

**UX notes:**

- **Deferred detail** — MVP capacity without bed configuration
- Stepper pattern avoids invalid keyboard input
- Ends Phase 1; next screen is Passo 2 interstitial

![Step 10](../Screenshot%202026-05-22%20at%2009.31.42.png)

---

## Chapter summary

| Field | Collected in Phase 1 |
|-------|----------------------|
| `property_type` | One of ~27 taxonomy values |
| `space_type` | entire \| room \| hostel_shared |
| `latitude/longitude` | Map pin |
| `show_exact_location` | boolean |
| `max_guests`, `bedrooms`, `beds`, `bathrooms` | integers |

**Next:** [02 — Stand out](02-phase-stand-out.md)
