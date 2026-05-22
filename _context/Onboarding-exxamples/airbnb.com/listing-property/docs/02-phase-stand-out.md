# 02 — Phase 2: Stand out

**Passo 2 — Faça o seu espaço destacar-se.** Merchandising: amenities, photos (minimum 5), title, highlight tags, and description.

[← 01 About your space](01-phase-about-your-space.md) · [Hub](../readme.md) · Next: [03 — Finish and publish](03-phase-finish-and-publish.md)

**Progress bar:** Segment 2 of 3 becomes active at step 11.

---

### Step 11 — Passo 2 interstitial

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.31.52.png` |
| Timestamp | 09:31:52 |
| Screen type | interstitial |
| Primary CTA | Seguinte |
| Next enabled when | Always |

**Goal:** Preview Phase 2 work — amenities, 5+ photos, title, description.

**UI elements:**

- **Passo 2** label
- Heading: **Faça o seu espaço destacar-se** *(Make your space stand out)*
- Body: amenities + 5+ photos, then title and description
- Same house illustration as Passo 1
- Progress: segment 1 complete (black), segment 2 started

![Step 11](../Screenshot%202026-05-22%20at%2009.31.52.png)

---

### Step 12 — Amenities (unselected)

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.32.02.png` |
| Timestamp | 09:32:02 |
| Screen type | wizard (multi-select grid) |
| Primary CTA | Seguinte |
| Next enabled when | Not blocked — amenities appear optional at this step |

**Goal:** Select amenities; grouped by guest demand and "standout" features.

**UI elements:**

- Title: **Diga aos viajantes o que o seu espaço tem para oferecer** *(Tell travelers what your space offers)*
- Subtitle: can add more after publishing
- **Section A — "E que tal estas opções? São Favoritos dos hóspedes!"** (8 items):
  Wi-Fi, TV, Cozinha, Máquina de lavar roupa, Estacionamento gratuito no local, Estacionamento pago no local, Ar condicionado, Espaço de trabalho exclusivo
- **Section B — "Tem alguma comodidade de destaque?"** (12 items):
  Piscina, Jacúzi, Pátio, Grelha de churrasco, Zona de refeições ao ar livre, Braseiro de jardim, Mesa de bilhar, Lareira interior, Piano, Equipamento de ginástica, Acesso ao lago, Acesso à praia
- All cards unselected (thin grey border)

![Step 12](../Screenshot%202026-05-22%20at%2009.32.02.png)

---

### Step 13 — Amenities (selected)

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.32.56.png` |
| Timestamp | 09:32:56 |
| Screen type | wizard (same screen, selections applied) |
| Primary CTA | Seguinte |

**Goal:** Same screen after host toggles amenities.

**Selected in capture (thick black border):**

- Favorites: Wi-Fi, TV, Cozinha, Máquina de lavar roupa, Estacionamento gratuito, Ar condicionado, Espaço de trabalho exclusivo
- Standout: Piscina, Jacúzi, Grelha de churrasco, Zona de refeições ao ar livre, Braseiro de jardim, Mesa de bilhar, Lareira interior
- Not selected: Estacionamento pago, Pátio, Piano, Ginástica, Lago, Praia

**UX notes:** Multi-select toggle cards; no maximum shown.

![Step 13](../Screenshot%202026-05-22%20at%2009.32.56.png)

---

### Step 14 — Photos empty state

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.33.05.png` |
| Timestamp | 09:33:05 |
| Screen type | wizard (upload) |
| Primary CTA | Adicionar fotos |
| Next enabled when | ≥ 5 photos uploaded |

**Goal:** Enforce minimum photo count for publish-quality listing.

**UI elements:**

- Title: **Adicione algumas fotos da sua casa particular** *(Add some photos of your private home)* — copy adapts to property type
- Subtitle: **Para começar, precisa de 5 fotos.** Can add more later.
- Dashed drop zone + 3D camera illustration
- Button: **Adicionar fotos**
- **Seguinte** disabled (grey)

![Step 14](../Screenshot%202026-05-22%20at%2009.33.05.png)

---

### Step 15 — Upload modal (2 photos)

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.33.25.png` |
| Timestamp | 09:33:25 |
| Screen type | modal |
| Primary CTA | Carregar (Upload) |
| Next enabled when | N/A (modal); main Next still needs 5 photos |

**Goal:** Review selection before upload.

**UI elements:**

- Modal: **Carregar fotografias** — **2 itens selecionados**
- X close · + add more
- Two large previews (patio sunset, aerial pool) with trash icons
- Filmstrip of additional thumbnails
- **Cancelar** · **Carregar** (primary black)

![Step 15](../Screenshot%202026-05-22%20at%2009.33.25.png)

---

### Step 16 — Upload modal (5 photos, size error)

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.34.03.png` |
| Timestamp | 09:34:03 |
| Screen type | modal |
| Primary CTA | Carregar |

**Goal:** Upload batch with client-side size validation.

**UI elements:**

- **5 itens selecionados**
- 2×2 grid + one tile; first image badge: **MAIS DE 25 MB** (orange warning)
- Background page title visible: **Escolha pelo menos 5 fotos**
- Main **Seguinte** still disabled

**Validation:**

- Max file size **25 MB** per image

![Step 16](../Screenshot%202026-05-22%20at%2009.34.03.png)

---

### Step 17 — Partial upload feedback

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.34.18.png` |
| Timestamp | 09:34:18 |
| Screen type | modal + main grid |
| Primary CTA | Concluído / Carregar |

**Goal:** Report partial success; guide user to fix oversized files.

**UI elements:**

- Toast in modal: **4 de 5 fotos carregadas** — some items not uploaded; choose files ≤ 25 MB
- Main page: cover photo grid, **Foto de capa** label, **Arrastar para reordenar**
- **Adicionar mais** placeholder tile
- **Carregar** disabled in modal until issue resolved

**UX notes:** Partial success messaging avoids "start over" frustration.

![Step 17](../Screenshot%202026-05-22%20at%2009.34.18.png)

---

### Step 18 — Photo review and organize

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.34.33.png` |
| Timestamp | 09:34:33 |
| Screen type | wizard (gallery) |
| Primary CTA | Seguinte (enabled once ≥5 photos) |
| Next enabled when | Minimum photos met |

**Goal:** Confirm gallery order and cover; offer smart sort.

**UI elements:**

- Title: **Já está! O que acha?** *(Done! What do you think?)*
- Subtitle: drag to reorder · + button to add more
- Large cover image with **Foto de capa** tag
- Grid of thumbnails with ⋯ menu per image
- Coachmark popup: **Comece com as suas melhores fotos** — **Organizar fotos** CTA

![Step 18](../Screenshot%202026-05-22%20at%2009.34.33.png)

---

### Step 19 — Listing title

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.34.42.png` |
| Timestamp | 09:34:42 |
| Screen type | wizard (text input) |
| Primary CTA | Seguinte |
| Next enabled when | Title length > 0 (max 50) |

**Goal:** Short searchable listing title.

**UI elements:**

- Title: **Agora, vamos atribuir um título a casa particular**
- Hint: short titles work best; editable later
- Large textarea · counter **0/50**
- **Seguinte** disabled at 0 characters

![Step 19](../Screenshot%202026-05-22%20at%2009.34.42.png)

---

### Step 20 — Description highlights

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.35.25.png` |
| Timestamp | 09:35:25 |
| Screen type | wizard (multi-select chips, max 2) |
| Primary CTA | Seguinte |

**Goal:** Pick up to 2 vibe tags to seed description text.

**UI elements:**

- Title: **Em seguida, vamos descrever a sua casa particular**
- Subtitle: choose up to 2; used to start description
- Chips: Calmo, Único, Próprio para famílias, Com estilo, Central, Espaçoso (icons each)
- Progress: segment 2 ~80% filled

![Step 20](../Screenshot%202026-05-22%20at%2009.35.25.png)

---

### Step 21 — Listing description

| Field | Value |
|-------|-------|
| Screenshot | `Screenshot 2026-05-22 at 09.35.55.png` |
| Timestamp | 09:35:55 |
| Screen type | wizard (textarea) |
| Primary CTA | Seguinte |
| Next enabled when | Non-empty (likely) |

**Goal:** Free-text description with AI-assisted starter copy.

**UI elements:**

- Title: **Crie a sua descrição** *(Create your description)*
- Subtitle: share what makes the space special
- Prefilled text: **Relaxe com toda a família neste alojamento tranquilo.**
- Counter: **53/500**

**UX notes:** Highlights from step 20 → generated opener; host can edit.

![Step 21](../Screenshot%202026-05-22%20at%2009.35.55.png)

---

## Chapter summary

| Asset | Rules |
|-------|-------|
| Amenities | Multi-select, two tiers; more can be added post-publish |
| Photos | Min 5; max 25 MB each; cover + order |
| Title | Max 50 chars |
| Highlights | Max 2 tags |
| Description | Max 500 chars |

**Next:** [03 — Finish and publish](03-phase-finish-and-publish.md)
