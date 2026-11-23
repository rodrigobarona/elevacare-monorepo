# Three brand directions for the Eleva public site

Status: Proposed. Three options from the brand seat of the research panel, 2026-11-23, after the
founder opened the whole public design for a rethink. Reference ids are from
`_context/mobbin/library/15-brand-art-direction/references.json` (written here as `15/NN`).
The founder chooses; nothing below is decided. The logo's drawing stays in all three.

## Today, in five lines

1. Cream page (#FDFAF5) and deep teal (#006D77). Teal is the button, the links, the numerals, the icons and both dark bands; coral appears once.
2. Fraunces headings (the brand book still says Lora) and DM Sans. Hero about 56px on desktop; an italic phrase in five of six headings.
3. Photographs from many stock shoots and eight advisor headshots on eight backgrounds. No shared light, crop or grade.
4. No shapes or illustration. The leaf lives only in the logo; icon-in-a-disc cards fill the gaps.
5. Every section is eyebrow, serif heading, paragraph, row of rounded cards. Page, alternate section and card are nearly one colour. The footer is a link list.

Contrast was calculated, not judged by eye:

```python
def lin(c): c/=255; return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def lum(h): r,g,b=(int(h[i:i+2],16) for i in (1,3,5)); return 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)
def ratio(a,b): hi,lo=sorted((lum(a),lum(b)),reverse=True); return (hi+0.05)/(lo+0.05)
```

---

## Direction A: Tide (evolves today's cream and teal)

**Feeling:** warm paper and deep sea; the Eleva people know, with more depth and one clear voice.

**Palette** (roles as in 15/03; deeper page as in 15/01)

| Role                        | Colour     | Hex     | Contrast                                       |
| --------------------------- | ---------- | ------- | ---------------------------------------------- |
| Page                        | Sand       | #F6EFE6 | ink on it 12.97; second ink #55615F 5.64       |
| Surface (cards, fields)     | Paper      | #FFFDF9 | ink 14.56                                      |
| Text                        | Ink        | #1D2A2C |                                                |
| Primary action              | Deep teal  | #0B5A63 | label #FFFDF9 on it 7.78; as link on page 6.93 |
| Emphasis words, small marks | Terracotta | #A8492A | on page 5.04, on paper 5.66, on mist 4.60      |
| Deep field, once per page   | Sea        | #0E3338 | sand text 11.88; sage #83C5BE 6.90             |
| Trust and health facts only | Mist       | #DCE9E3 | ink 11.84; teal 6.33                           |

**Type.** Display Fraunces, weight 300 to 400, italic for one phrase per page (15/01). Text DM Sans. Both SIL Open Font Licence 1.1 and already self-hosted. Desktop: hero 80/84, section 44/50, body 18/28, small 14/20. Phone: hero 44/48, section 30/36, body 17/26, small 14/20.

**Imagery.** Real experts and members, with consent, in their own rooms in Lisbon and Porto; one window, late-afternoon side light; clothing in sand, clay and deep tones, no bright teal. Experts 4:5, chest up; care moments as 3:2 crops of hands and gestures (15/02, 15/06). One painted sand backdrop that travels to each shoot (15/05). Until then: existing headshots in black and white under a sea-to-clear wash at one crop (15/12), and type-on-mist tiles in place of the stock service photos (15/07).

**Shape and components.** Two radii (15/22): full pill for buttons and chips, 16px for cards and fields. Portrait frames take an arch top, echoing the leaf. Cards are filled paper or mist with no border; a hairline (#E6DCCD) only between rows. Shadow only on the floating booking card. Button 48px tall, deep teal. Chip: paper with a 1px #7A8583 edge (3.34 on the page).

**Motion.** A photograph is revealed from behind its arch over 560ms as it enters; the italic phrase fades in 120ms after its sentence. With reduced motion, both simply appear.

**Risks.** It may read as a tidy-up, not a rethink: test by covering the logo and asking five people who it is, against today's page. Sand, teal and terracotta sit near Oura and Function: keep teal dominant. Photography cost: start with ten pictures.

---

## Direction B: Clay and Aubergine (a clear departure in colour)

**Feeling:** grounded, womanly and warm, with no clinical blue-green and no pink.

**Palette** (colour fields with roles as in 15/18; a coloured section needs no cards, 15/19)

| Role                                       | Colour        | Hex     | Contrast                                         |
| ------------------------------------------ | ------------- | ------- | ------------------------------------------------ |
| Page                                       | Blush paper   | #FBF3EC | ink on it 15.00; second ink #65505B 6.71         |
| Surface                                    | Cream         | #FFFAF5 | ink 15.87                                        |
| Text                                       | Aubergine ink | #2B1A24 |                                                  |
| Primary action                             | Terracotta    | #A23E22 | label #FFFAF5 on it 6.23; as link on page 5.89   |
| Shapes and backdrops, never words on light | Marigold      | #E2A63B | ink on it 7.64 (1.96 on the page, so shape only) |
| Deep field                                 | Aubergine     | #3A1830 | blush text 14.14; marigold 7.21                  |
| Trust and health facts only                | Lilac mist    | #E9E0F0 | ink 12.84; terracotta 5.04                       |

**Type.** Display Bricolage Grotesque, weight 500, with emphasis by colour, not italics (15/04). Text Figtree. Both SIL Open Font Licence 1.1. Desktop: hero 68/72, section 40/46, body 18/28, small 14/20. Phone: hero 40/44, section 28/34, body 17/26, small 14/20. If Bricolage reads as playful in Portuguese, Figtree 500 takes the display role.

**Imagery.** A shape system leads: leaf, arch, disc and half disc in marigold, lilac, terracotta and aubergine, cropped large (15/09, 15/23). People appear as cut-outs on those colours at one crop (15/10), or against one painted clay wall (15/05). Until real photography: cut-outs made from the headshots Eleva already holds, and shapes alone everywhere else. No stock.

**Shape and components.** Cards are colour-filled, 24px radius, no border, no shadow. Button: terracotta pill, 48px. Chip: lilac or blush fill, ink label, no edge. Fields: cream with a 1px #8A7480 edge (3.91). Sections change background colour instead of using dividers.

**Motion.** The page background cross-fades between section colours over 320ms on scroll; shapes drift no more than 8px. With reduced motion, colours switch at the section edge and shapes stay still.

**Risks.** The teal logo becomes an orphan: it would need recolouring in aubergine (14.14 on the page), which is the founder's call. Clay and rust are near Function and Hims; plum can read as beauty. Marigold must never carry words on light. Test with a five-second test ("what does this company do, and would you trust it with your health?") with women aged 28 to 55 in Portugal and Spain.

---

## Direction C: Folio (led by typography and editorial layout)

**Feeling:** a well-edited health journal you can book from; quiet, exact and unhurried.

**Palette** (deep green and ivory as in 15/20; almost no colour elsewhere, 15/13)

| Role                              | Colour     | Hex     | Contrast                                 |
| --------------------------------- | ---------- | ------- | ---------------------------------------- |
| Page                              | Ivory      | #FAF7F0 | ink on it 15.59; second ink #55605A 6.12 |
| Surface                           | White      | #FFFFFF | ink 16.68                                |
| Text                              | Ink        | #17201B |                                          |
| Primary action and the deep field | Forest     | #1C3A2E | label #FAF7F0 on it 11.59                |
| Links, numerals                   | Fern       | #1F5A43 | on page 7.54, on sage 6.60               |
| Highlight behind one phrase       | Butter     | #F1E1A0 | ink on it 12.72; on forest 9.46          |
| Trust and health facts only       | Sage paper | #E2EBDD | ink 13.63                                |

**Type.** Display Newsreader at its display optical size, weight 300, roman set against italic (15/20, 15/14). Text Newsreader for prose, with DM Sans for controls and IBM Plex Mono for numbered labels. All SIL Open Font Licence 1.1. Desktop: hero 112/108 (about 8% of the width), section 56/60, body 19/30, small 14/20. Phone: hero 52/54, section 34/38, body 18/28, small 14/20.

**Imagery.** Few pictures, each large: one documentary photograph per page, muted, bleeding off an edge (15/02, 15/15). Expert portraits in black and white. Elsewhere, pull quotes, numerals and hairlines stand in for images (15/21, 15/17). Until real photography: no pictures except expert portraits.

**Shape and components.** 4px radius; no filled cards. Rows sit on 1px rules (#D9D3C4), numbered 01, 02, 03 (15/17). Layouts alternate: one lead and four (15/16), statement with two columns (15/13), tall picture beside short text (15/15). Button: forest, 6px radius, 48px. Chips are mono labels with an underline. The footer is the wordmark at full width (15/24).

**Motion.** Headline lines rise 12px and fade in, 40ms apart; link underlines draw in 200ms. With reduced motion, everything is in place at load.

**Risks.** It can feel like a magazine, not a service: booking controls must stay plain DM Sans and high on the page; test "find a pelvic physiotherapist and see her price" for time and errors. Serif body with long Portuguese and Spanish words at 360px: test line breaks. With few pictures, weak expert portraits show; the photo guide (15/11) becomes essential. The teal logo needs a forest version.

---

## Recommendation

1. Direction A, Tide, as the base: it fixes today's real weaknesses (roles for colour, depth of page, one treatment for photographs) and keeps the logo, the fonts and the token scales, so it can ship through `@eleva/ui` without a rebrand.
2. Borrow two things from C: one display moment per page at 8% of the width, and numbered rows on hairlines in place of some card rows.
3. Keep B's shape system as the answer for pages with no photograph, in A's colours.
4. B is the stronger statement and the higher risk; it is worth one homepage mock-up beside A before the founder decides, since it changes the logo colour.
5. Whichever is chosen, do the two free things first: put every existing photograph through one treatment, and write down one job per colour.
