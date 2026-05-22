#!/usr/bin/env python3
"""Generate experience onboarding MD chapters and index.html from step index."""

from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).parent
DOCS = ROOT / "docs"

STEPS = [
    # 00 entry
    ("00", "00-entry-category-and-city", 1, "09.52.08", "pre-wizard", None, "wizard", "Anterior", "category selected", "Select experience category", "Que Experiência vai oferecer?", "Choose primary experience category from five illustrated cards."),
    ("00", "00-entry-category-and-city", 2, "09.52.15", "pre-wizard", None, "wizard", "Próximo", "subtype selected", "Select experience subtype", "Como descreveria a Experiência?", "Food & drink sub-types: dinner, cooking class, gastronomic tour, tasting."),
    ("00", "00-entry-category-and-city", 3, "09.52.32", "pre-wizard", None, "wizard", "Próximo", "city entered", "Enter experience city", "Onde vai oferecer a sua experiência?", "City search with category preview card on the right."),
    ("00", "00-entry-category-and-city", 4, "09.52.44", "pre-wizard", None, "modal", "Próximo", "city selected", "City search suggestions", "Introduza uma cidade", "Autocomplete modal with locality suggestions (e.g. Parede, Portugal)."),
    ("00", "00-entry-category-and-city", 5, "09.52.55", "pre-wizard", None, "interstitial", "Comece já", "always", "Create listing intro", "Crie o seu anúncio", "Team will review listing against requirements before publish."),
    # 01 about you
    ("01", "01-about-you", 6, "09.53.06", "Sobre si", "Passo 1 de 7", "wizard", "Próximo", "years set", "Gastronomy experience years", "Quantos anos de experiência tem na área da gastronomia?", "Numeric stepper for years in field (category-specific copy)."),
    ("01", "01-about-you", 7, "09.53.17", "Sobre si", "Passo 2 de 7", "wizard", "Próximo", "profile cards complete", "Expertise overview", "Dê a conhecer o que faz de melhor", "Three credential cards: Apresentação, Qualificações, Reconhecimento."),
    ("01", "01-about-you", 8, "09.53.28", "Sobre si", "Passo 2 de 7", "modal", "Guardar", "title entered", "Add professional title modal", "Adicione o seu título profissional", "Title max 40 characters with Obter dicas link."),
    ("01", "01-about-you", 9, "09.54.22", "Sobre si", "Passo 2 de 7", "modal", "Guardar", "title entered", "Professional title filled", "Eu entusiasta da cozinha Valenciana", "Character counter (e.g. 35/40) on title field."),
    ("01", "01-about-you", 10, "09.54.29", "Sobre si", "Passo 2 de 7", "modal", "Close", "dismissed", "Title tips modal", "Como criar o seu título", "Example titles for inspiration."),
    ("01", "01-about-you", 11, "09.54.40", "Sobre si", "Passo 2 de 7", "wizard", "Próximo", "qualifications added", "Expertise with title saved", "Apresentação", "Apresentação card shows saved title; Qualificações and Reconhecimento still editable."),
    ("01", "01-about-you", 12, "09.55.11", "Sobre si", "Passo 2 de 7", "modal", "Guardar", "min 150 chars", "Add credentials modal", "Adicione a sua formação e as suas credenciais", "Qualifications textarea minimum 150 characters."),
    ("01", "01-about-you", 13, "09.56.14", "Sobre si", "Passo 2 de 7", "modal", "Guardar", "milestone entered", "Add professional milestone modal", "Adicione um marco profissional", "Optional recognition / milestone (max 90 chars)."),
    ("01", "01-about-you", 14, "09.56.32", "Sobre si", "Passo 3 de 7", "wizard", "Adicionar perfil / Saltar", "optional", "Add online profiles", "Adicione os seus perfis online", "Internal validation only — not shown on public listing."),
    ("01", "01-about-you", 15, "09.56.47", "Sobre si", "Passo 3 de 7", "modal", "Guardar", "valid URL", "Add link modal empty", "Adicionar ligação", "URL field for LinkedIn or other profile."),
    ("01", "01-about-you", 16, "09.57.00", "Sobre si", "Passo 3 de 7", "modal", "Guardar", "valid URL", "Add LinkedIn link", "www.linkedin.com/in/...", "Example LinkedIn URL entered."),
    ("01", "01-about-you", 17, "09.57.09", "Sobre si", "Passo 3 de 7", "wizard", "Próximo", "link saved or skipped", "Online profiles saved", "Adicione os seus perfis online", "Saved profile chips with remove option."),
    ("01", "01-about-you", 18, "09.57.19", "Sobre si", "Passo 4 de 7", "wizard", "Próximo", "address filled", "Personal address form", "Qual é a sua morada?", "Residential address — not shared with travelers."),
    ("01", "01-about-you", 19, "09.57.48", "Sobre si", "Passo 4 de 7", "wizard", "Próximo", "address confirmed", "Personal address confirmed", "Gil Vicente, 2 · Parede", "Full address with postal code confirmed."),
    # 02 location
    ("02", "02-location", 20, "09.58.00", "Local", "Passo 1 de 7", "wizard", "—", "address entered", "Meeting location search", "Onde é que as pessoas se irão encontrar consigo?", "Public meeting point visible on listing."),
    ("02", "02-location", 21, "09.58.13", "Local", "Passo 1 de 7", "wizard", "Próximo", "address filled", "Confirm location address", "Confirme o local", "Street, city, postal code fields for meeting point."),
    ("02", "02-location", 22, "09.58.22", "Local", "Passo 1 de 7", "modal", "Próximo", "suggestion selected", "Address autocomplete suggestions", "SUGESTÕES", "Pick from suggested addresses."),
    ("02", "02-location", 23, "09.58.37", "Local", "Passo 1 de 7", "wizard", "Próximo", "marker placed", "Confirm map marker", "O marcador está no local certo?", "Google Maps pin drag to reposition."),
    # 03 photos
    ("03", "03-photos", 24, "09.58.50", "Fotografias", "Passo 1 de 7", "wizard", "Adicionar", "≥5 photos", "Add photos empty state", "Adicione fotos únicas da sua Experiência Airbnb", "Minimum 5 unique experience photos required."),
    ("03", "03-photos", 25, "09.58.58", "Fotografias", "Passo 1 de 7", "modal", "Close", "dismissed", "Photo tips modal", "Como escolher as melhores fotografias", "Guidance on photo quality and variety."),
    ("03", "03-photos", 26, "09.59.19", "Fotografias", "Passo 1 de 7", "modal", "Adicionar", "photos selected", "Upload photos modal", "Carregar fotografias", "Multi-select upload with item count."),
    ("03", "03-photos", 27, "09.59.31", "Fotografias", "Passo 1 de 7", "wizard", "Próximo", "≥5 photos", "Photos grid partial (3)", "Adicione pelo menos 5 fotos", "Cover photo badge; Next disabled until minimum met."),
    ("03", "03-photos", 28, "09.59.48", "Fotografias", "Passo 1 de 7", "wizard", "Próximo", "≥5 photos", "Photos grid with 5+", "Adicione pelo menos 5 fotos", "Gallery with cover and reorder affordances."),
    # 04 experience
    ("04", "04-experience-details", 29, "09.59.59", "Experiência", "Passo 1 de 7", "wizard", "Próximo", "title entered", "Experience title empty", "Dê um título à sua Experiência", "Max 50 characters."),
    ("04", "04-experience-details", 30, "10.00.12", "Experiência", "Passo 1 de 7", "wizard", "Próximo", "title entered", "Experience title filled", "Experimente a Paella Valenciana", "Title with character counter (31/50)."),
    ("04", "04-experience-details", 31, "10.00.19", "Experiência", "Passo 2 de 7", "wizard", "Próximo", "description entered", "Experience description empty", "Descreva a sua Experiência", "Max 200 characters — what participants will do."),
    ("04", "04-experience-details", 32, "10.00.40", "Experiência", "Passo 2 de 7", "wizard", "Próximo", "description entered", "Experience description filled", "gosto de fazer paella tradicional...", "Description with counter (61/200)."),
    # 05 itinerary
    ("05", "05-itinerary", 33, "10.00.51", "Itinerário", "Passo 1 de 7", "interstitial", "Próximo", "always", "Itinerary intro", "Crie um itinerário", "Sample timeline cards explaining itinerary value."),
    ("05", "05-itinerary", 34, "10.01.01", "Itinerário", "Passo 1 de 7", "wizard", "Adicionar atividade", "≥1 activity", "Create itinerary empty", "Adicione até 10 atividades", "Empty state with add activity CTA."),
    ("05", "05-itinerary", 35, "10.01.09", "Itinerário", "Passo 1 de 7", "modal", "Seguinte", "title entered", "First activity title modal", "Dê um título à primeira atividade", "Activity title max 35 characters."),
    ("05", "05-itinerary", 36, "10.01.26", "Itinerário", "Passo 1 de 7", "modal", "Seguinte", "min 30 chars", "Activity description modal", "Descreva o que os participantes vão fazer", "Minimum 30 characters per activity."),
    ("05", "05-itinerary", 37, "10.01.53", "Itinerário", "Passo 1 de 7", "modal", "Seguinte", "min 30 chars met", "Activity description filled", "Entradas típicas da região", "Description meets minimum length."),
    ("05", "05-itinerary", 38, "10.02.00", "Itinerário", "Passo 1 de 7", "modal", "Seguinte", "duration set", "Set activity duration", "Defina a duração", "Duration picker (e.g. 60 minutes)."),
    ("05", "05-itinerary", 39, "10.02.07", "Itinerário", "Passo 1 de 7", "modal", "Seguinte", "photo selected", "Choose activity photo", "Escolha uma fotografia", "Pick from uploaded experience photos."),
    ("05", "05-itinerary", 40, "10.02.14", "Itinerário", "Passo 1 de 7", "modal", "Seguinte", "photo selected", "Activity photo selected", "Entradas típicas da região", "Selected thumbnail highlighted."),
    ("05", "05-itinerary", 41, "10.02.26", "Itinerário", "Passo 1 de 7", "wizard", "Próximo", "activities complete", "Itinerary list incomplete", "Adicionar detalhes", "Activity row with duration; incomplete second activity."),
    ("05", "05-itinerary", 42, "10.02.37", "Itinerário", "Passo 1 de 7", "modal", "Editar", "edited", "Edit activity modal", "Editar · Remover", "Edit or remove existing activity."),
    ("05", "05-itinerary", 43, "10.02.52", "Itinerário", "Passo 1 de 7", "modal", "Seguinte", "title entered", "Second activity title modal", "Prove tortilla de batata", "Second activity title entry."),
    # 06 pricing — note: group size may be end of itinerary section in UI
    ("06", "06-pricing", 44, "10.03.07", "Preços", "Passo 1 de 7", "wizard", "Próximo", "group size set", "Maximum group size", "Adicione o número máximo de pessoas", "Stepper for max participants."),
    ("06", "06-pricing", 45, "10.03.16", "Preços", "Passo 1 de 7", "wizard", "Próximo", "group size set", "Maximum group size adjusted", "10", "Example: 10 guests maximum."),
    ("06", "06-pricing", 46, "10.03.28", "Preços", "Passo 2 de 7", "wizard", "Próximo", "price entered", "Price per person empty", "Preço por pessoa", "Currency input with earnings preview."),
    ("06", "06-pricing", 47, "10.03.34", "Preços", "Passo 2 de 7", "modal", "Close", "dismissed", "Pricing tips modal", "Como definir o preço da sua Experiência", "Pricing guidance modal."),
    ("06", "06-pricing", 48, "10.03.53", "Preços", "Passo 2 de 7", "wizard", "Próximo", "price entered", "Price per person entered", "€16 · O seu rendimento: €13", "Host earnings after service fee."),
    ("06", "06-pricing", 49, "10.04.01", "Preços", "Passo 2 de 7", "wizard", "Próximo", "price set", "Price breakdown expanded", "Taxa de serviço 20%", "Expanded fee breakdown."),
    ("06", "06-pricing", 50, "10.04.13", "Preços", "Passo 2 de 7", "modal", "Close", "dismissed", "More pricing info modal", "Mais informação sobre os preços", "Additional pricing education."),
    ("06", "06-pricing", 51, "10.04.27", "Preços", "Passo 3 de 7", "wizard", "Próximo / Saltar", "price or skip", "Minimum private group price empty", "Preço mínimo para grupos privados", "Optional private group minimum."),
    ("06", "06-pricing", 52, "10.04.36", "Preços", "Passo 3 de 7", "wizard", "Próximo", "price entered", "Minimum private group price entered", "€150 · rendimento €120", "Private group minimum with earnings."),
    ("06", "06-pricing", 53, "10.04.43", "Preços", "Passo 3 de 7", "wizard", "Próximo", "price set", "Minimum private group breakdown", "Vai ganhar €120", "Fee breakdown for private minimum."),
    ("06", "06-pricing", 54, "10.04.52", "Preços", "Passo 4 de 7", "wizard", "Próximo", "prices set", "Review prices summary", "Reveja os seus preços", "Summary before discounts."),
    ("06", "06-pricing", 55, "10.05.00", "Preços", "Passo 5 de 7", "wizard", "Próximo", "optional", "Add discounts", "Adicione descontos", "Optional promotional discounts."),
    ("06", "06-pricing", 56, "10.05.09", "Preços", "Passo 5 de 7", "modal", "Guardar", "discount set", "Limited time discount modal", "Desconto por tempo limitado", "e.g. 10% for 90 days."),
    ("06", "06-pricing", 57, "10.05.22", "Preços", "Passo 5 de 7", "modal", "Aplique um desconto", "discount confirmed", "Early bird discount modal", "Desconto para reservas antecipadas", "20% early booking discount."),
    ("06", "06-pricing", 58, "10.05.39", "Preços", "Passo 5 de 7", "modal", "Guardar", "min + % entered", "Large group discount modal empty", "Desconto para grupos grandes", "Minimum people + discount %."),
    ("06", "06-pricing", 59, "10.05.48", "Preços", "Passo 5 de 7", "modal", "Guardar", "configured", "Large group discount filled", "Mínimo 20 · 5%", "Example: 20+ guests, 5% off."),
    # 07 details
    ("07", "07-details-and-submit", 60, "10.05.59", "Detalhes", "Passo 1 de 7", "wizard", "Concordo", "all answered", "Offer details questionnaire", "Partilhe detalhes sobre o que irá oferecer", "Yes/No: transport, licensed transport, food, kitchen, alcohol."),
    ("07", "07-details-and-submit", 61, "10.06.23", "Detalhes", "Passo 1 de 7", "wizard", "Concordo", "all answered", "Offer details answered", "Vai servir comida?", "Compliance questions completed."),
    ("07", "07-details-and-submit", 62, "10.06.30", "Detalhes", "Passo 2 de 7", "wizard", "Concordo", "terms acknowledged", "Requirements and terms", "Requisitos e termos", "Experience Terms and policies acceptance."),
    ("07", "07-details-and-submit", 63, "10.06.39", "Detalhes", "Passo 7 de 7", "review", "Pedir para publicar", "all sections complete", "Publish listing review", "Publicar o anúncio", "Dark review screen with section checklist and preview card."),
    # 08 post
    ("08", "08-post-submission", 64, "10.06.55", "post", None, "interstitial", "Concluído", "always", "Submission confirmation", "Agradecemos o seu envio", "Thank-you after request to publish."),
    ("08", "08-post-submission", 65, "10.07.11", "post", None, "dashboard", "—", "always", "Listings dashboard", "Os seus anúncios · Enviado", "Listing card with Enviado status badge."),
    ("08", "08-post-submission", 66, "10.07.39", "post", None, "editor", "Gerir fotos", "N/A", "Listing editor photos", "Editor de anúncios · Em análise", "Post-submit listing editor while under review."),
    ("08", "08-post-submission", 67, "10.07.50", "post", None, "settings", "—", "N/A", "Edit preferences documents", "Documentos", "Post-create preferences — documents."),
    ("08", "08-post-submission", 68, "10.08.03", "post", None, "settings", "Adicionar um imposto", "always", "Edit preferences taxes", "Impostos", "Tax configuration after submission."),
    ("08", "08-post-submission", 69, "10.13.51", "post", None, "overlay", "Close", "N/A", "Publish steps sidebar", "Passos para publicar · Aprovação em curso", "Checklist: approval in progress, identity steps done."),
    ("08", "08-post-submission", 70, "10.14.09", "post", None, "dashboard", "—", "always", "Listings table view", "Experimente a Paella Valenciana", "Table view of all listings with status."),
]

CHAPTER_META = {
    "00-entry-category-and-city": ("00 — Entry, category, and city", "Pre-wizard: category drill-down, city, intro.", "01-about-you"),
    "01-about-you": ("01 — About you", "Sobre si: credentials, profiles, residential address.", "02-location"),
    "02-location": ("02 — Location", "Local: meeting point and map pin.", "03-photos"),
    "03-photos": ("03 — Photos", "Fotografias: minimum 5 experience photos.", "04-experience-details"),
    "04-experience-details": ("04 — Experience details", "Experiência: title and description.", "05-itinerary"),
    "05-itinerary": ("05 — Itinerary", "Itinerário: up to 10 activities with nested modals.", "06-pricing"),
    "06-pricing": ("06 — Pricing", "Preços: per-person, private minimum, discounts.", "07-details-and-submit"),
    "07-details-and-submit": ("07 — Details and submit", "Detalhes: compliance Q&A and Pedir para publicar.", "08-post-submission"),
    "08-post-submission": ("08 — Post-submission", "Dashboard, review status, preferences.", "99-patterns-and-data-model"),
}


def slug(title: str) -> str:
    s = title.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return f"step-{s}"[:60]


def img_path(ts: str) -> str:
    name = f"Screenshot 2026-05-22 at {ts}.png"
    return "../" + name.replace(" ", "%20")


def render_step(step: tuple) -> str:
    ch, file, n, ts, section, sec_step, stype, cta, gate, title, pt, goal = step
    anchor = slug(title)
    meta_rows = [
        f"| Screenshot | `Screenshot 2026-05-22 at {ts}.png` |",
        f"| Timestamp | {ts.replace('.', ':')} |",
        f"| Section | {section} |",
    ]
    if sec_step:
        meta_rows.append(f"| Section step | {sec_step} |")
    meta_rows.extend([
        f"| Screen type | {stype} |",
        f"| Primary CTA | {cta} |",
        f"| Next enabled when | {gate} |",
    ])
    lines = [
        f"### Step {n} — {title}",
        "",
        "| Field | Value |",
        "|-------|-------|",
        *meta_rows,
        "",
        f"**Goal:** {goal}",
        "",
        "**Copy (PT):**",
        f"- {pt}",
        "",
        "**Validation / gating:**",
        f"- {gate}",
        "",
        "**UX notes:**",
        f"- See screenshot for full layout and secondary controls.",
        "",
        f"![Step {n}]({img_path(ts)})",
        "",
        "---",
        "",
    ]
    return "\n".join([l for l in lines if l is not None])


def write_chapters():
    by_file: dict[str, list] = {}
    for s in STEPS:
        by_file.setdefault(s[1], []).append(s)

    for fname, steps in by_file.items():
        title, desc, nxt = CHAPTER_META[fname]
        if nxt == "99-patterns-and-data-model":
            next_line = f"Next: [99 — Patterns]({nxt}.md)"
        else:
            next_line = f"Next: [{CHAPTER_META[nxt][0]}]({nxt}.md)"
        body = "\n".join(render_step(s) for s in steps)
        content = f"""# {title}

{desc}

[← Hub](../readme.md) · {next_line}

---

{body}
"""
        (DOCS / f"{fname}.md").write_text(content, encoding="utf-8")


def md_to_html_fragment(md: str) -> str:
    """Minimal MD to HTML for generated chapters."""
    out: list[str] = []
    in_table = False
    in_list = False
    i = 0
    lines = md.split("\n")

    def close_table():
        nonlocal in_table
        if in_table:
            out.append("</tbody></table>")
            in_table = False

    def close_list():
        nonlocal in_list
        if in_list:
            out.append("</ul>")
            in_list = False

    while i < len(lines):
        line = lines[i]
        if line.startswith("# "):
            close_table()
            close_list()
            out.append(f"<h2>{html.escape(line[2:])}</h2>")
        elif line.startswith("### "):
            close_table()
            close_list()
            anchor = slug(line[4:])
            out.append(f'<h3 id="{anchor}">{html.escape(line[4:])}</h3>')
        elif line.startswith("## "):
            close_table()
            close_list()
            out.append(f"<h2>{html.escape(line[3:])}</h2>")
        elif line.startswith("!["):
            m = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", line)
            if m:
                close_table()
                close_list()
                alt, src = m.group(1), m.group(2)
                src_html = src.replace("%20", " ")
                out.append(f'<figure class="screenshot"><img src="{html.escape(src_html)}" alt="{html.escape(alt)}" loading="lazy" /><figcaption>{html.escape(alt)}</figcaption></figure>')
        elif line.startswith("|") and "|" in line[1:]:
            close_list()
            cells = [c.strip() for c in line.strip("|").split("|")]
            if all(re.match(r"^[-:]+$", c) for c in cells):
                i += 1
                continue
            if not in_table:
                out.append('<table class="meta"><tbody>')
                in_table = True
                is_header = i + 1 < len(lines) and re.match(r"^\|[-:| ]+\|$", lines[i + 1])
                if is_header:
                    out.append("<tr>" + "".join(f"<th>{html.escape(c)}</th>" for c in cells) + "</tr>")
                    i += 2
                    continue
            out.append("<tr>" + "".join(f"<td>{html.escape(c)}</td>" for c in cells) + "</tr>")
        elif line.startswith("- "):
            close_table()
            if not in_list:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{html.escape(line[2:])}</li>")
        elif line.startswith("**") and line.endswith("**"):
            close_table()
            close_list()
            key, _, rest = line.partition(":**")
            out.append(f"<p><strong>{html.escape(key[2:])}</strong>{html.escape(rest)}</p>")
        elif line.strip() == "---":
            close_table()
            close_list()
            out.append("<hr />")
        elif line.strip() == "":
            pass
        elif line.startswith("[") and "](" in line:
            close_table()
            close_list()
            out.append(f"<p>{line}</p>")
        else:
            close_table()
            close_list()
            out.append(f"<p>{html.escape(line)}</p>")
        i += 1
    close_table()
    close_list()
    return "\n".join(out)


def write_index_html():
    nav = [
        ("overview", "Overview"),
        ("entry", "00 — Entry"),
        ("about", "01 — About you"),
        ("location", "02 — Location"),
        ("photos", "03 — Photos"),
        ("experience", "04 — Experience"),
        ("itinerary", "05 — Itinerary"),
        ("pricing", "06 — Pricing"),
        ("details", "07 — Details"),
        ("post", "08 — Post-submission"),
        ("patterns", "99 — Patterns"),
    ]
    nav_ul = "\n".join(f'<li><a href="#{id_}">{label}</a></li>' for id_, label in nav)

    sections = []
    ids = {
        "00-entry-category-and-city": "entry",
        "01-about-you": "about",
        "02-location": "location",
        "03-photos": "photos",
        "04-experience-details": "experience",
        "05-itinerary": "itinerary",
        "06-pricing": "pricing",
        "07-details-and-submit": "details",
        "08-post-submission": "post",
    }
    for fname, sec_id in ids.items():
        md = (DOCS / f"{fname}.md").read_text(encoding="utf-8")
        # strip nav links at top
        md_body = md.split("---\n", 2)[-1] if md.count("---") >= 2 else md
        frag = md_to_html_fragment(md_body)
        sections.append(f'<section id="{sec_id}" class="chapter">\n{frag}\n</section>')

    patterns_md = (DOCS / "99-patterns-and-data-model.md").read_text(encoding="utf-8")
    patterns_body = patterns_md.split("---\n", 1)[-1]
    patterns_html = md_to_html_fragment(patterns_body)

    index_rows = "\n".join(
        f'<tr><td>{n}</td><td>{ts.replace(".", ":")}</td><td>{html.escape(title)}</td><td><a href="#{ids.get(file, "overview")}">→</a></td></tr>'
        for _, file, n, ts, _, _, _, _, _, title, _, _ in STEPS
    )

    overview = f"""<section id="overview" class="chapter">
<h2>Overview</h2>
<p>Reference documentation for the <strong>host flow to create a new Experiência (experience) listing</strong> on Airbnb (2026-05-22, Portuguese UI).</p>
<p><strong>Example experience:</strong> Experimente a Paella Valenciana — Prova gastronómica · Comida e bebida · Parede, Portugal · €16/person.</p>
<h3>How to read</h3>
<ul>
<li><strong>Markdown (SSOT):</strong> <a href="readme.md">readme.md</a> and <a href="docs/">docs/</a> chapters</li>
<li><strong>This HTML:</strong> visual walkthrough with inline screenshots</li>
</ul>
<h3>Screenshot index (70 steps)</h3>
<table class="index"><thead><tr><th>#</th><th>Time</th><th>Step</th><th>Jump</th></tr></thead><tbody>
{index_rows}
</tbody></table>
</section>"""

    html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Airbnb — Create experience onboarding</title>
  <style>
    :root {{
      --bg: #fff; --fg: #222; --muted: #717171; --border: #ebebeb;
      --accent: #ff385c; --sidebar-w: 280px;
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--fg); background: var(--bg); }}
    .layout {{ display: flex; min-height: 100vh; }}
    nav.sidebar {{
      width: var(--sidebar-w); flex-shrink: 0; position: sticky; top: 0; height: 100vh;
      overflow-y: auto; border-right: 1px solid var(--border); padding: 1.25rem 1rem;
      background: #fafafa;
    }}
    nav.sidebar h1 {{ font-size: 0.95rem; margin: 0 0 1rem; line-height: 1.35; }}
    nav.sidebar ul {{ list-style: none; padding: 0; margin: 0; }}
    nav.sidebar li {{ margin: 0.35rem 0; }}
    nav.sidebar a {{ color: var(--fg); text-decoration: none; font-size: 0.875rem; }}
    nav.sidebar a:hover {{ color: var(--accent); }}
    main {{ flex: 1; max-width: 920px; padding: 2rem 2.5rem 4rem; }}
    .chapter {{ margin-bottom: 3rem; }}
    h2 {{ font-size: 1.5rem; margin-top: 0; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }}
    h3 {{ font-size: 1.15rem; margin-top: 2rem; scroll-margin-top: 1rem; }}
    p, li {{ line-height: 1.6; }}
    table.meta, table.index {{ width: 100%; border-collapse: collapse; font-size: 0.875rem; margin: 1rem 0; }}
    table th, table td {{ border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }}
    table th {{ background: #f7f7f7; }}
    figure.screenshot {{ margin: 1.25rem 0; }}
    figure.screenshot img {{ max-width: 100%; height: auto; border: 1px solid var(--border); border-radius: 8px; }}
    figcaption {{ font-size: 0.8rem; color: var(--muted); margin-top: 0.35rem; }}
    hr {{ border: none; border-top: 1px solid var(--border); margin: 2rem 0; }}
    a {{ color: #008489; }}
    @media (max-width: 768px) {{
      .layout {{ flex-direction: column; }}
      nav.sidebar {{ position: relative; width: 100%; height: auto; }}
      main {{ padding: 1rem; }}
    }}
  </style>
</head>
<body>
  <div class="layout">
    <nav class="sidebar" aria-label="Chapters">
      <h1>Airbnb experience onboarding</h1>
      <ul>{nav_ul}</ul>
      <p style="font-size:0.75rem;color:var(--muted);margin-top:1.5rem">Markdown SSOT: <a href="readme.md">readme.md</a></p>
    </nav>
    <main>
      {overview}
      {"".join(sections)}
      <section id="patterns" class="chapter">{patterns_html}</section>
    </main>
  </div>
</body>
</html>"""
    (ROOT / "index.html").write_text(html_doc, encoding="utf-8")


def write_readme():
    rows = []
    ch_links = {
        "00-entry-category-and-city": "00",
        "01-about-you": "01",
        "02-location": "02",
        "03-photos": "03",
        "04-experience-details": "04",
        "05-itinerary": "05",
        "06-pricing": "06",
        "07-details-and-submit": "07",
        "08-post-submission": "08",
    }
    for _, file, n, ts, _, _, _, _, _, title, _, _ in STEPS:
        ch = ch_links[file]
        anchor = slug(title)
        rows.append(
            f"| {n} | {ts.replace('.', ':')} | `Screenshot 2026-05-22 at {ts}.png` | "
            f"[{ch}](docs/{file}.md#{anchor}) | {title} |"
        )

    content = f"""# Airbnb — Create experience listing onboarding

Reference documentation for the **host flow to create a new Experiência (experience) listing** on Airbnb, captured from a live walkthrough on **2026-05-22** (Portuguese UI).

Use this when designing multi-step onboarding for Eleva: category drill-down, sidebar-section wizards, credential building, itinerary nested flows, team-review publish, and post-submit dashboards.

---

## How to read

| Mode | Path | Best for |
|------|------|----------|
| **Markdown (SSOT)** | This file → [`docs/`](docs/) chapters | Engineers, agents, diffs, specs |
| **HTML (visual)** | [`index.html`](index.html) | Design / PM review in a browser |
| **Quick lookup** | [Screenshot index](#screenshot-index) below | Jump to step by timestamp |

**Example experience in walkthrough:** **Experimente a Paella Valenciana** — Prova gastronómica · Comida e bebida · Parede, Portugal · €16/person (host earnings €13).

**Related:** [Accommodation listing flow](../listing-property/readme.md) (shared entry modal — **Experiência** branch).

---

## Flow overview

```mermaid
flowchart TD
  pre[00 Entry category city intro]
  s1[01 About you]
  s2[02 Location]
  s3[03 Photos]
  s4[04 Experience details]
  s5[05 Itinerary]
  s6[06 Pricing]
  s7[07 Details submit]
  post[08 Post submission]
  patterns[99 Patterns]
  pre --> s1 --> s2 --> s3 --> s4 --> s5 --> s6 --> s7 --> post
  s1 -.-> patterns
  s5 -.-> patterns
  s7 -.-> patterns
```

### Wizard sections (7-module sidebar)

| # | Sidebar (PT) | Chapter | Steps | Screenshots |
|---|--------------|---------|-------|-------------|
| — | Pre-wizard | [00-entry-category-and-city](docs/00-entry-category-and-city.md) | 5 | 1–5 |
| 1 | Sobre si | [01-about-you](docs/01-about-you.md) | 14 | 6–19 |
| 2 | Local | [02-location](docs/02-location.md) | 4 | 20–23 |
| 3 | Fotografias | [03-photos](docs/03-photos.md) | 5 | 24–28 |
| 4 | Experiência | [04-experience-details](docs/04-experience-details.md) | 4 | 29–32 |
| 5 | Itinerário | [05-itinerary](docs/05-itinerary.md) | 11 | 33–43 |
| 6 | Preços | [06-pricing](docs/06-pricing.md) | 16 | 44–59 |
| 7 | Detalhes | [07-details-and-submit](docs/07-details-and-submit.md) | 4 | 60–63 |
| Post | — | [08-post-submission](docs/08-post-submission.md) | 7 | 64–70 |
| Ref | — | [99-patterns-and-data-model](docs/99-patterns-and-data-model.md) | — | Cross-cutting |

**Total interactive steps documented:** 70 screenshots (chronological).

### Persistent chrome (wizard steps)

- **Top left:** Airbnb logo
- **Top center:** Section name + `Passo N de 7` (when in sidebar wizard)
- **Top right:** `Gravar e sair` (Save and exit)
- **Left:** Dark sidebar with 7 section icons (profile, location, photos, food, book, pricing, details)
- **Bottom:** `Anterior` / `Próximo` or section-specific CTAs (`Pedir para publicar`, `Concordo`)
- **Publish model:** Team review — not instant live (status **Enviado** / **Em curso**)

### Sidebar icon legend

| Icon | Section (PT) | Purpose |
|------|--------------|---------|
| Profile | Sobre si | Host credentials and address |
| Pin | Local | Meeting point on map |
| Gallery | Fotografias | Experience photos (min 5) |
| Fork/knife | Experiência | Title and description |
| Book | Itinerário | Activity timeline (≤10) |
| Tag/price | Preços | Per-person and discounts |
| Details | Detalhes | Compliance + submit |

---

## Chapters

1. **[Entry, category, and city](docs/00-entry-category-and-city.md)** — Category grid, food sub-type, city, intro
2. **[About you](docs/01-about-you.md)** — Years in field, credentials, online profiles, residential address
3. **[Location](docs/02-location.md)** — Meeting address and map pin
4. **[Photos](docs/03-photos.md)** — Minimum 5 photos, upload modal
5. **[Experience details](docs/04-experience-details.md)** — Title (50 chars), description (200 chars)
6. **[Itinerary](docs/05-itinerary.md)** — Activities with nested title/description/duration/photo modals
7. **[Pricing](docs/06-pricing.md)** — Per person, private minimum, discounts, review
8. **[Details and submit](docs/07-details-and-submit.md)** — Compliance Q&A, terms, **Pedir para publicar**
9. **[Post-submission](docs/08-post-submission.md)** — Dashboard **Enviado**, review checklist, preferences
10. **[Patterns and data model](docs/99-patterns-and-data-model.md)** — Reusable UX patterns and implied fields

**Visual walkthrough:** open [`index.html`](index.html) in a browser.

---

## Screenshot index

| # | Time | File | Chapter | Step title |
|---|------|------|---------|------------|
{chr(10).join(rows)}

---

## Listing lifecycle (summary)

```mermaid
stateDiagram-v2
  [*] --> PreWizard: Host picks Experiência
  PreWizard --> WizardDraft: Comece já
  WizardDraft --> WizardDraft: Sections 1-7
  WizardDraft --> Submitted: Pedir para publicar
  Submitted --> UnderReview: Enviado / Em curso
  UnderReview --> Published: Team approval
```

Unlike accommodation **Criar anúncio**, experiences use **team review** before going live.
"""
    (ROOT / "readme.md").write_text(content, encoding="utf-8")


if __name__ == "__main__":
    DOCS.mkdir(exist_ok=True)
    write_chapters()
    print("Wrote chapter MD files")
    write_readme()
    print("Wrote readme.md")
    write_index_html()
    print("Wrote index.html")
