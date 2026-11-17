// Builds the design audit page and the Mobbin library readmes.
//
//   node docs/eleva-v3/design-audit/build.mjs
//
// Sources (edit these, never the output):
//   _context/mobbin/library/{surface}/references.json   findings, references, criteria
//   docs/eleva-v3/design-audit/plan.json                top moves and roadmap
//   docs/eleva-v3/design-audit/captures/{label}/        screenshots and videos
// Output:
//   docs/eleva-v3/design-audit/index.html
//   _context/mobbin/library/{surface}/readme.md
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "../../..")
const libraryDir = path.join(root, "_context/mobbin/library")
const capturesDir = path.join(here, "captures")
const libraryHref = "../../../_context/mobbin/library"

const plan = JSON.parse(readFileSync(path.join(here, "plan.json"), "utf8"))
const baseline = plan.baseline

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
const dirs = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : []
const files = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => !name.startsWith("."))
        .sort()
    : []
const href = (...parts) =>
  parts.join("/").split("/").map(encodeURIComponent).join("/")

// ---------------------------------------------------------------- sources

const surfaces = dirs(libraryDir)
  .filter((name) => existsSync(path.join(libraryDir, name, "references.json")))
  .map((name) => ({
    // A surface may start with references only (e.g. 11-team before its audit).
    strengths: [],
    findings: [],
    references: [],
    judging_criteria: [],
    ...JSON.parse(
      readFileSync(path.join(libraryDir, name, "references.json"), "utf8")
    ),
    dir: name,
  }))

/** "2026-11-16-x-before" or "2026-11-15-before-x": a slice's before set. */
const isBefore = (label) => /(^|-)before(-|$)/.test(label)
const dateOf = (label) => label.slice(0, 10)

const laterLabels = dirs(capturesDir).filter(
  (label) =>
    label !== baseline && !isBefore(label) && !label.startsWith("scratch")
)

/**
 * Latest after capture of the same file that is not older than its before
 * (an after taken before the before would pair the wrong way round).
 */
function afterOf(surface, file, since = "") {
  for (const label of [...laterLabels].reverse()) {
    if (dateOf(label) < since) continue
    if (existsSync(path.join(capturesDir, label, surface, file))) {
      return { label, src: href("captures", label, surface, file) }
    }
  }
  return null
}

const beforeLabels = dirs(capturesDir).filter(
  (label) => label !== baseline && isBefore(label)
)

/**
 * The first capture of a file: the baseline, else the latest slice
 * "-before" set that has it (a page first captured by a later slice).
 */
function beforeOf(surface, file) {
  if (existsSync(path.join(capturesDir, baseline, surface, file))) {
    return { label: baseline, src: href("captures", baseline, surface, file) }
  }
  for (const label of [...beforeLabels].reverse()) {
    if (existsSync(path.join(capturesDir, label, surface, file))) {
      return { label, src: href("captures", label, surface, file) }
    }
  }
  return null
}

function shotsOf(surface) {
  const groups = new Map()
  // Every file any set captured for this surface, not only the baseline's,
  // so pages first captured by a later slice show up too.
  const names = new Set(
    [baseline, ...beforeLabels, ...laterLabels].flatMap((label) =>
      files(path.join(capturesDir, label, surface))
    )
  )
  for (const file of [...names].sort()) {
    const match = file.match(/^(.*)\.(desktop|mobile)\.(jpg|webm)$/)
    if (!match) continue
    const [, base, viewport, ext] = match
    const before = beforeOf(surface, file)
    const after = afterOf(surface, file, before ? dateOf(before.label) : "")
    // No before at all: the first capture is shown as it is.
    const entry = before
      ? { viewport, file, src: before.src, after }
      : { viewport, file, src: after.src, after: null, only: true }
    if (!groups.has(base)) groups.set(base, { base, stills: [], videos: [] })
    groups.get(base)[ext === "webm" ? "videos" : "stills"].push(entry)
  }
  return [...groups.values()].sort((a, b) => a.base.localeCompare(b.base))
}

const sliceOfFinding = new Map()
for (const phase of plan.phases) {
  for (const slice of phase.slices) {
    for (const id of slice.findings) {
      if (sliceOfFinding.has(id)) {
        console.warn(`finding ${id} is in two slices`)
      }
      sliceOfFinding.set(id, slice.id)
    }
  }
}
const allFindings = surfaces.flatMap((surface) =>
  surface.findings.map((finding) => ({ ...finding, surface: surface.dir }))
)
const findingIds = new Set(allFindings.map((finding) => finding.id))
for (const finding of allFindings) {
  if (!sliceOfFinding.has(finding.id)) {
    console.warn(`finding ${finding.id} has no slice in plan.json`)
  }
}
for (const id of sliceOfFinding.keys()) {
  if (!findingIds.has(id)) console.warn(`plan.json names unknown ${id}`)
}

const count = (severity) =>
  allFindings.filter((finding) => finding.severity === severity).length
const referenceCount = surfaces.reduce(
  (sum, surface) => sum + surface.references.length,
  0
)
const stillCount = surfaces.reduce(
  (sum, surface) =>
    sum + shotsOf(surface.dir).reduce((n, shot) => n + shot.stills.length, 0),
  0
)
const videoCount = surfaces.reduce(
  (sum, surface) =>
    sum + shotsOf(surface.dir).reduce((n, shot) => n + shot.videos.length, 0),
  0
)

// ---------------------------------------------------------------- readmes

function readme(surface) {
  const cell = (text) => String(text ?? "").replaceAll("|", "\\|")
  const lines = [
    `# ${surface.title}`,
    "",
    `> Generated from \`references.json\` by \`docs/eleva-v3/design-audit/build.mjs\`. Edit the JSON, then run the build.`,
    "",
    `Researcher seat: ${surface.researcher}. Date: ${surface.date}. Before captures: \`docs/eleva-v3/design-audit/captures/${baseline}/${surface.dir}/\`.`,
    "",
    surface.summary,
    "",
    "## Keep",
    "",
    ...surface.strengths.map((item) => `- ${item}`),
    "",
    "## Findings",
    "",
    "| ID | Sev | Lens | Finding | Do instead | Slice |",
    "| --- | --- | --- | --- | --- | --- |",
    ...surface.findings.map(
      (finding) =>
        `| ${finding.id} | ${finding.severity} | ${finding.lens} | ${cell(finding.title)} | ${cell(finding.recommendation)} | ${sliceOfFinding.get(finding.id) ?? ""} |`
    ),
    "",
    "## Mobbin references",
    "",
    "| Ref | App | Pattern | What Eleva takes from it | Mobbin |",
    "| --- | --- | --- | --- | --- |",
    ...surface.references.map(
      (reference) =>
        `| [${reference.id.split("/")[1]}](${reference.file}) | ${cell(reference.app)} (${reference.platform}) | ${cell(reference.pattern)} | ${cell(reference.apply)} | [open](${reference.mobbin_url}) |`
    ),
    "",
    "## Judging criteria",
    "",
    "A review panel scores a new design for this surface against these, with the references open.",
    "",
    ...surface.judging_criteria.map((item, index) => `${index + 1}. ${item}`),
    "",
  ]
  return lines.join("\n")
}

for (const surface of surfaces) {
  writeFileSync(
    path.join(libraryDir, surface.dir, "readme.md"),
    readme(surface)
  )
}

// ---------------------------------------------------------------- page

const titleOf = (base) =>
  base
    .replace(/^\d+[a-z]?-/, "")
    .replaceAll("-", " ")
    .replace(/^./, (letter) => letter.toUpperCase())

const chip = (id) =>
  findingIds.has(id)
    ? `<a class="chip" href="#${id}">${id}</a>`
    : `<span class="chip">${esc(id)}</span>`

function still(entry, caption) {
  const frame = (src, tag) =>
    `<button class="frame ${entry.viewport}" data-full="${src}" data-caption="${esc(caption)} · ${entry.viewport} · ${tag}"><img loading="lazy" src="${src}" alt="${esc(caption)}, ${entry.viewport}, ${tag}"><span>${tag}</span></button>`
  if (entry.only) return frame(entry.src, "after")
  return entry.after
    ? frame(entry.src, "before") + frame(entry.after.src, "after")
    : frame(entry.src, "before")
}

function shotCard(shot) {
  const caption = titleOf(shot.base)
  const stills = shot.stills
    .sort((a, b) => a.viewport.localeCompare(b.viewport))
    .map((entry) => still(entry, caption))
    .join("")
  const videos = shot.videos
    .sort((a, b) => a.viewport.localeCompare(b.viewport))
    .map(
      (entry) =>
        `<figure class="video ${entry.viewport}"><video controls preload="none" src="${entry.src}"></video><figcaption>${entry.viewport} · before${entry.after ? ` · <a href="${entry.after.src}">after (${esc(entry.after.label)})</a>` : ""}</figcaption></figure>`
    )
    .join("")
  return `<div class="shot"><h5>${esc(caption)}${shot.videos.length ? " (video)" : ""}</h5><div class="frames">${stills}${videos}</div></div>`
}

function evidenceLink(surface, item) {
  const rel = item.includes("/") ? item : `${surface.dir}/${item}`
  const src = href("captures", baseline, rel)
  return item.endsWith(".webm")
    ? `<a class="evidence" href="${src}">${esc(item)}</a>`
    : `<button class="evidence" data-full="${src}" data-caption="${esc(rel)}">${esc(item)}</button>`
}

function findingBlock(surface, finding) {
  const slice = sliceOfFinding.get(finding.id)
  const references = (finding.references ?? [])
    .map(
      (id) =>
        `<a class="chip ref" href="#ref-${id.replace("/", "-")}">${id}</a>`
    )
    .join("")
  return `<details class="finding" id="${finding.id}" data-sev="${finding.severity}">
  <summary><span class="sev ${finding.severity}">${finding.severity}</span><code>${finding.id}</code><span class="lens">${esc(finding.lens)}</span><strong>${esc(finding.title)}</strong>${slice ? `<a class="chip slice" href="#${slice}">${slice}</a>` : ""}</summary>
  <div class="body">
    <p><b>What is weak.</b> ${esc(finding.detail)}</p>
    <p><b>Do instead.</b> ${esc(finding.recommendation)}</p>
    <p class="meta">Evidence: ${(finding.evidence ?? []).map((item) => evidenceLink(surface, item)).join(" ")}</p>
    ${references ? `<p class="meta">Mobbin references: ${references}</p>` : ""}
  </div>
</details>`
}

function referenceCard(surface, reference) {
  const images = reference.files ?? [reference.file]
  const caption = `${reference.app} · ${reference.pattern}`
  return `<article class="reference" id="ref-${reference.id.replace("/", "-")}">
  <div class="ref-images">${images
    .map((file) => {
      const src = `${libraryHref}/${href(surface.dir, file)}`
      return `<button class="frame ref" data-full="${src}" data-caption="${esc(caption)}" data-mobbin="${esc(reference.mobbin_url)}"><img loading="lazy" src="${src}" alt="${esc(caption)}"></button>`
    })
    .join("")}</div>
  <p class="ref-head"><code>${reference.id}</code> <b>${esc(reference.app)}</b> <span class="lens">${esc(reference.platform)} · ${esc(reference.type)}</span></p>
  <h5>${esc(reference.pattern)}</h5>
  <p>${esc(reference.why)}</p>
  <p><b>Eleva takes:</b> ${esc(reference.apply)}</p>
  <p class="meta"><a href="${esc(reference.mobbin_url)}" target="_blank" rel="noreferrer">Open on Mobbin</a></p>
</article>`
}

function surfaceSection(surface) {
  const shots = shotsOf(surface.dir)
  const hasAfter = shots.some((shot) =>
    [...shot.stills, ...shot.videos].some((entry) => entry.after)
  )
  const sev = (severity) =>
    surface.findings.filter((finding) => finding.severity === severity).length
  return `<section class="surface" id="${surface.dir}"><div class="wrap">
  <header>
    <p class="eyebrow">${surface.dir} · ${esc(surface.researcher)}</p>
    <h2>${esc(surface.title)}</h2>
    <p class="lede">${esc(surface.summary)}</p>
    <p class="counts"><span class="sev P1">${sev("P1")} P1</span><span class="sev P2">${sev("P2")} P2</span><span class="sev P3">${sev("P3")} P3</span><span class="pill">${surface.references.length} Mobbin references</span><span class="pill ${hasAfter ? "done" : ""}">${hasAfter ? "After captured" : "After: not built yet"}</span></p>
  </header>
  <h3>Before</h3>
  ${shots.length ? `<div class="shots">${shots.map(shotCard).join("")}</div>` : `<p class="meta">This seat reviewed captures from other surfaces; see the evidence links in each finding.</p>`}
  <h3>Keep</h3>
  <ul class="keep">${surface.strengths.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
  <h3>Findings</h3>
  ${surface.findings.map((finding) => findingBlock(surface, finding)).join("\n")}
  <h3>Mobbin references</h3>
  <div class="references">${surface.references.map((reference) => referenceCard(surface, reference)).join("\n")}</div>
  <h3>Judging criteria</h3>
  <p class="meta">The review panel scores the "after" captures against these, with the references above open. <span class="score" data-total="${surface.judging_criteria.length}">0 / ${surface.judging_criteria.length}</span></p>
  <ol class="criteria">${surface.judging_criteria.map((item) => `<li><label><input type="checkbox"> <span>${esc(item)}</span></label></li>`).join("")}</ol>
</div></section>`
}

const roadmap = plan.phases
  .map(
    (phase) => `<div class="phase">
  <h3>Phase ${phase.id}. ${esc(phase.title)}</h3>
  <p class="lede">${esc(phase.goal)}</p>
  <div class="table"><table>
    <thead><tr><th>Slice</th><th>What ships</th><th>Size</th><th>Closes</th></tr></thead>
    <tbody>${phase.slices
      .map(
        (slice) => `<tr id="${slice.id}">
      <td><code>${slice.id}</code><br><b>${esc(slice.title)}</b>${slice.legalReview ? `<br><span class="pill legal">Legal review first</span>` : ""}</td>
      <td>${esc(slice.scope)}</td>
      <td>${slice.effort}</td>
      <td class="chips">${slice.findings.map(chip).join("") || "—"}</td>
    </tr>`
      )
      .join("")}</tbody>
  </table></div>
</div>`
  )
  .join("\n")

const topMoves = plan.topMoves
  .map(
    (move, index) =>
      `<li><span class="num">${index + 1}</span><div><h4>${esc(move.title)}</h4><p>${esc(move.why)}</p><p class="chips">${move.findings.map(chip).join("")}</p></div></li>`
  )
  .join("")

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(plan.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Lora:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
<style>
:root{--teal:#0b6b70;--deep:#053b44;--cream:#fcf9f4;--sand:#f5ede4;--line:#e6dccf;--ink:#1d2a2c;--muted:#5d6b6d;--coral:#d9825f;--card:#fff;--p1:#b3261e;--p2:#a15c00;--p3:#3d6b4f}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:64px}
body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.55 "DM Sans",system-ui,sans-serif}
h1,h2,h3,h4,h5{font-family:Lora,Georgia,serif;font-weight:600;line-height:1.2;margin:0;text-wrap:balance}
h1{font-size:clamp(2rem,5vw,3.2rem)}h2{font-size:clamp(1.6rem,3.5vw,2.3rem)}
h3{font-size:1.3rem;margin:2.2rem 0 .8rem}h4{font-size:1.1rem}h5{font-size:.98rem;font-family:"DM Sans",sans-serif;font-weight:600}
p{margin:.5rem 0}a{color:var(--teal)}code{font:500 .8rem ui-monospace,Menlo,monospace;color:var(--deep);overflow-wrap:anywhere}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.hero{background:var(--deep);color:#f4efe7;padding:56px 0 44px}
.hero h1 em{font-style:italic;font-weight:500}.hero p{max-width:62ch;color:#d5e3e3}
.eyebrow{font:500 .72rem ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--teal)}
.hero .eyebrow{color:#9fd0d0}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.stat{background:#0d4d57;border-radius:16px;padding:12px 16px;min-width:120px}
.stat b{display:block;font:600 1.6rem Lora,serif}.stat span{font-size:.8rem;color:#bcd6d6}
nav.toc{position:sticky;top:0;z-index:5;background:rgba(252,249,244,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
nav.toc .wrap{display:flex;gap:10px;padding-top:10px;padding-bottom:10px;align-items:center}
nav.toc .links{display:flex;gap:6px;overflow-x:auto;flex:1;min-width:0;scrollbar-width:none}
nav.toc a{white-space:nowrap;text-decoration:none;font-size:.85rem;padding:5px 11px;border-radius:999px;color:var(--ink)}
nav.toc a:hover{background:var(--sand)}
.filter{flex:none;display:flex;gap:4px}
.filter button{font:500 .8rem "DM Sans",sans-serif;border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 10px;cursor:pointer;white-space:nowrap}
.filter button[aria-pressed=true]{background:var(--deep);color:#fff;border-color:var(--deep)}
section{padding:52px 0;border-bottom:1px solid var(--line)}
.lede{color:var(--muted);max-width:75ch;font-size:1.05rem}
.moves{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.moves li{display:flex;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:18px}
.num{font:italic 500 1.9rem Lora,serif;color:var(--teal);line-height:1}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{font:500 .72rem ui-monospace,Menlo,monospace;text-decoration:none;background:var(--sand);color:var(--deep);border-radius:6px;padding:2px 6px}
.chip.ref{background:#e3f1f1}.chip.slice{background:#fbe6dc;margin-left:auto}
.pill{font-size:.78rem;border:1px solid var(--line);border-radius:999px;padding:2px 10px;background:#fff}
.pill.legal{border-color:var(--coral);color:#8a3f20}.pill.done{background:#e3f1e6;border-color:#9cc7a8}
.sev{font:600 .72rem "DM Sans",sans-serif;border-radius:6px;padding:2px 7px;color:#fff}
.sev.P1{background:var(--p1)}.sev.P2{background:var(--p2)}.sev.P3{background:var(--p3)}
.counts{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px}
.table{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:18px}
table{border-collapse:collapse;width:100%;min-width:720px;font-size:.92rem}
th,td{text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid var(--line)}
th{font:500 .72rem ui-monospace,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
tr:last-child td{border-bottom:0}td:first-child{min-width:190px}td.chips{min-width:200px}
tr:target,details:target>summary,article:target{outline:2px solid var(--coral);outline-offset:2px}
.steps{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));padding:0;list-style:none;counter-reset:s}
.steps li{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;counter-increment:s}
.steps li::before{content:counter(s,decimal-leading-zero);font:italic 500 1.5rem Lora,serif;color:var(--teal);display:block}
.shots{display:flex;gap:16px;overflow-x:auto;padding:4px 2px 14px}
.shot{flex:none;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:12px}
.frames{display:flex;gap:10px;margin-top:8px;align-items:flex-start}
.frame{position:relative;display:block;padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--sand);cursor:zoom-in;height:300px}
.frame img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.frame.desktop{width:400px}.frame.mobile{width:139px}
.frame span{position:absolute;left:6px;bottom:6px;font-size:.68rem;background:rgba(5,59,68,.85);color:#fff;border-radius:5px;padding:1px 6px}
.frame.ref{height:auto;width:100%;aspect-ratio:16/11}.frame.ref img{object-fit:contain;background:#f1ece5}
figure.video{margin:0}figure.video video{display:block;height:300px;border-radius:10px;border:1px solid var(--line);background:#000}
figure.video.desktop video{width:480px}figure.video.mobile video{width:139px}
figcaption{font-size:.75rem;color:var(--muted);margin-top:4px}
.keep{color:var(--muted);padding-left:1.1rem;max-width:85ch}
details.finding{background:var(--card);border:1px solid var(--line);border-radius:14px;margin:8px 0}
details.finding summary{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:11px 14px;cursor:pointer;list-style:none}
details.finding summary::-webkit-details-marker{display:none}
details.finding strong{font-weight:500;flex:1 1 320px}
.lens{font-size:.75rem;color:var(--muted)}
.body{padding:2px 16px 14px;max-width:95ch}.meta{font-size:.85rem;color:var(--muted)}
.evidence{font:500 .75rem ui-monospace,Menlo,monospace;background:none;border:0;border-bottom:1px dashed var(--teal);color:var(--teal);padding:0;margin-right:8px;cursor:zoom-in;text-decoration:none}
body[data-sev=P1] .finding:not([data-sev=P1]),body[data-sev=P2] .finding:not([data-sev=P2]),body[data-sev=P3] .finding:not([data-sev=P3]){display:none}
.references{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.reference{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:12px;font-size:.9rem}
.ref-images{display:grid;gap:6px;grid-template-columns:repeat(auto-fit,minmax(110px,1fr))}
.ref-head{margin-top:10px}
.criteria{padding-left:1.3rem;max-width:95ch}.criteria li{margin:6px 0}.criteria label{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.criteria input{margin-top:5px;accent-color:var(--teal)}
.score{font:600 .85rem ui-monospace,Menlo,monospace;color:var(--deep);background:var(--sand);border-radius:6px;padding:2px 8px;margin-left:6px}
dialog{border:0;padding:0;background:transparent;max-width:96vw;max-height:96vh}
dialog::backdrop{background:rgba(5,30,35,.86)}
dialog .box{display:flex;flex-direction:column;max-height:96vh}
dialog .scroll{overflow:auto;border-radius:10px;background:#fff}
dialog img{display:block;max-width:min(96vw,1500px);height:auto}
dialog .bar{display:flex;gap:14px;align-items:center;color:#fff;padding:8px 2px;font-size:.88rem}
dialog .bar a{color:#9fd0d0}dialog .bar button{margin-left:auto;font:500 .85rem "DM Sans",sans-serif;border:0;border-radius:999px;padding:6px 14px;cursor:pointer}
footer{padding:36px 0;color:var(--muted);font-size:.85rem}
@media (max-width:640px){.filter button{padding:5px 8px}nav.toc .wrap{padding-left:12px;padding-right:12px}.frame.desktop{width:300px}.frame,figure.video video{height:240px}.frame.mobile,figure.video.mobile video{width:111px}figure.video.desktop video{width:320px}section{padding:38px 0}}
</style>
</head>
<body>
<div class="hero"><div class="wrap">
  <p class="eyebrow">Eleva Care · design audit · ${esc(plan.date)}</p>
  <h1>Where the design is weak, <em>and what to build instead</em></h1>
  <p>Every key screen was captured on desktop and phone, reviewed by a six-seat panel, and matched to patterns from shipped products on Mobbin. ${esc(plan.status)}</p>
  <div class="stats">
    <div class="stat"><b>${allFindings.length}</b><span>findings</span></div>
    <div class="stat"><b>${count("P1")}</b><span>P1, core path</span></div>
    <div class="stat"><b>${count("P2")}</b><span>P2, quality</span></div>
    <div class="stat"><b>${count("P3")}</b><span>P3, polish</span></div>
    <div class="stat"><b>${referenceCount}</b><span>Mobbin references</span></div>
    <div class="stat"><b>${stillCount}</b><span>before screenshots</span></div>
    <div class="stat"><b>${videoCount}</b><span>before videos</span></div>
  </div>
</div></div>
<nav class="toc"><div class="wrap"><div class="links">
  <a href="#moves">Top moves</a><a href="#roadmap">Roadmap</a><a href="#method">Method</a>
  ${surfaces.map((surface) => `<a href="#${surface.dir}">${esc(surface.dir.replace(/^\d+-/, "").replaceAll("-", " "))}</a>`).join("")}
  <a href="#gaps">Gaps</a></div>
  <span class="filter" role="group" aria-label="Filter findings by severity">${["All", "P1", "P2", "P3"].map((value) => `<button data-sev="${value}" aria-pressed="${value === "All"}">${value}</button>`).join("")}</span>
</div></nav>
<main>
<section id="moves"><div class="wrap">
  <p class="eyebrow">Start here</p>
  <h2>Seven moves that change the most</h2>
  <p class="lede">The panel's ${count("P1")} P1 findings cluster into these. Each chip opens the finding with its evidence and references.</p>
  <ol class="moves">${topMoves}</ol>
</div></section>
<section id="roadmap"><div class="wrap">
  <p class="eyebrow">Plan</p>
  <h2>Roadmap, one small slice at a time</h2>
  <p class="lede">Each slice is one short PR. Sizes: S about a day, M two to three days, L about a week. Every finding is assigned to exactly one slice.</p>
  ${roadmap}
</div></section>
<section id="method"><div class="wrap">
  <p class="eyebrow">Method</p>
  <h2>How each slice is designed and judged</h2>
  <p class="lede">The same loop for every design challenge from now on. Mobbin sets the bar; the Eleva logo, palette, type and voice stay.</p>
  <ol class="steps">
    <li><h5>Search Mobbin</h5><p>Search for the slice's problems and add what teaches something to <code>_context/mobbin/library/{surface}/references.json</code>.</p></li>
    <li><h5>Capture before</h5><p>Run the capture spec if the surface changed since ${esc(baseline)}.</p></li>
    <li><h5>Design and build</h5><p>One slice, against the findings it closes and the references they cite.</p></li>
    <li><h5>Capture after</h5><p>Same spec, new label. This page then shows before and after side by side.</p></li>
    <li><h5>Judges panel</h5><p>Three judges score out of 10: UI and visual design; UX and UX writing; trust, legal, compliance and accessibility. Each reads the after captures against the surface's criteria with the references open.</p></li>
    <li><h5>Pass or revise</h5><p>A slice ships only when every judge scores 8.5 or more and its P1 findings are closed. Otherwise it is revised and judged again. Anything marked for legal review also goes to a lawyer before launch.</p></li>
  </ol>
  <p class="meta">Capture command: <code>E2E_DESIGN_CAPTURE=1 E2E_SKIP_WEBSERVER=1 E2E_ALLOW_DB_WRITES=1 DESIGN_CAPTURE_LABEL={date}-{slice} pnpm exec playwright test e2e/design-capture.spec.ts --project=chromium --workers=1</code>, then <code>node docs/eleva-v3/design-audit/build.mjs</code>.</p>
</div></section>
${surfaces.map(surfaceSection).join("\n")}
<section id="gaps"><div class="wrap">
  <p class="eyebrow">Honest limits</p>
  <h2>What this pass did not cover</h2>
  <ul class="keep">${plan.notCovered.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
</div></section>
</main>
<footer><div class="wrap">Generated by <code>docs/eleva-v3/design-audit/build.mjs</code>. Reference screens are from Mobbin and belong to their owners; they are kept here for internal design review.</div></footer>
<dialog id="lightbox"><div class="box"><div class="bar"><span id="lb-caption"></span><a id="lb-mobbin" target="_blank" rel="noreferrer" hidden>Open on Mobbin</a><button id="lb-close">Close</button></div><div class="scroll"><img id="lb-img" alt=""></div></div></dialog>
<script>
const box = document.getElementById("lightbox")
document.addEventListener("click", (event) => {
  const zoom = event.target.closest("[data-full]")
  if (zoom) {
    document.getElementById("lb-img").src = zoom.dataset.full
    document.getElementById("lb-caption").textContent = zoom.dataset.caption || ""
    const link = document.getElementById("lb-mobbin")
    link.hidden = !zoom.dataset.mobbin
    if (zoom.dataset.mobbin) link.href = zoom.dataset.mobbin
    box.showModal()
    return
  }
  if (event.target === box || event.target.id === "lb-close") box.close()
  const filter = event.target.closest(".filter button")
  if (filter) {
    const value = filter.dataset.sev
    if (value === "All") delete document.body.dataset.sev
    else document.body.dataset.sev = value
    document.querySelectorAll(".filter button").forEach((button) =>
      button.setAttribute("aria-pressed", String(button === filter))
    )
  }
})
function openTarget() {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
  if (target && target.tagName === "DETAILS") target.open = true
}
addEventListener("hashchange", openTarget)
openTarget()
document.addEventListener("change", (event) => {
  const list = event.target.closest(".criteria")
  if (!list) return
  const score = list.previousElementSibling.querySelector(".score")
  score.textContent = list.querySelectorAll("input:checked").length + " / " + score.dataset.total
})
</script>
</body>
</html>
`

writeFileSync(path.join(here, "index.html"), html)
console.log(
  `${surfaces.length} surfaces, ${allFindings.length} findings (${count("P1")} P1, ${count("P2")} P2, ${count("P3")} P3), ${referenceCount} references, ${stillCount} stills, ${videoCount} videos`
)
