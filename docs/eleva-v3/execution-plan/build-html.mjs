#!/usr/bin/env node
/**
 * Build a single self-contained, offline `index.html` from the execution plan Markdown.
 *
 * Markdown is the source of truth. Run `pnpm docs:execution-plan:html` after editing
 * `README.md` or any `phases/*.md`, then commit the regenerated `index.html`.
 *
 * Output is deterministic: same inputs produce byte-identical HTML (no timestamps).
 */
import { readdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Marked } from "marked"

const here = path.dirname(fileURLToPath(import.meta.url))
const readmePath = path.join(here, "README.md")
const phasesDir = path.join(here, "phases")
const outPath = path.join(here, "index.html")

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

/** @param {string} value */
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

/**
 * @typedef {{ id: string, title: string, file: string, markdown: string }} Doc
 * @typedef {{ id: string, text: string, depth: number }} Heading
 */

/** @returns {Promise<Doc[]>} */
async function loadDocs() {
  const readme = await readFile(readmePath, "utf8")
  const phaseFiles = (await readdir(phasesDir))
    .filter((name) => name.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b, "en"))

  /** @type {Doc[]} */
  const docs = [
    {
      id: "readme",
      title: firstHeading(readme),
      file: "README.md",
      markdown: readme,
    },
  ]
  for (const name of phaseFiles) {
    const markdown = await readFile(path.join(phasesDir, name), "utf8")
    docs.push({
      id: name.replace(/\.md$/, ""),
      title: firstHeading(markdown),
      file: `phases/${name}`,
      markdown,
    })
  }
  return docs
}

/** @param {string} markdown */
function firstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m)
  // Sidebar labels are plain text: drop inline-code backticks from the heading.
  return match ? match[1].trim().replaceAll("`", "") : "Untitled"
}

/**
 * Rewrite a Markdown link so it resolves from index.html (which lives in execution-plan/,
 * next to README.md and one level above phases/). Cross-document links become in-page
 * anchors, preserving any heading fragment as the namespaced heading id.
 * @param {string} href
 * @param {string} docId
 */
function rewriteLink(href, docId) {
  if (/^(https?:)?\/\//.test(href) || href.startsWith("mailto:")) {
    return href
  }
  // Headings are rendered with `${docId}--${slug}` ids, so a same-document `#fragment`
  // must be namespaced (and normalised with the same slugify) to hit an element.
  if (href.startsWith("#")) {
    return `#${docId}--${slugify(decodeURIComponent(href.slice(1)))}`
  }
  const phaseLink = href.match(
    /(?:^|\/)(?:phases\/)?(\d{2}[a-z0-9-]*)\.md(?:#(.*))?$/i
  )
  if (phaseLink) {
    return phaseLink[2]
      ? `#${phaseLink[1]}--${slugify(decodeURIComponent(phaseLink[2]))}`
      : `#${phaseLink[1]}`
  }
  const readmeLink = href.match(/^(?:\.\/|\.\.\/)?README\.md(?:#(.*))?$/)
  if (readmeLink) {
    return readmeLink[1]
      ? `#readme--${slugify(decodeURIComponent(readmeLink[1]))}`
      : "#readme"
  }
  if (docId === "readme") return href
  // Links inside phases/*.md are relative to phases/, one level below index.html:
  // drop one "../" hop, and turn a sibling "x" into "phases/x".
  return href.startsWith("../")
    ? href.slice(3)
    : `phases/${href.replace(/^\.\//, "")}`
}

/**
 * Create a Marked instance scoped to one document so heading ids are prefixed and
 * cross-document links resolve to in-page anchors.
 * @param {Doc} doc
 * @param {Heading[]} headings
 * @param {{ count: number }} promptCounter
 */
function createRenderer(doc, headings, promptCounter) {
  const marked = new Marked({ gfm: true })
  /** @type {Map<string, number>} */
  const seen = new Map()

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens)
        let base = `${doc.id}--${slugify(text)}`
        const n = seen.get(base) ?? 0
        seen.set(base, n + 1)
        if (n > 0) base = `${base}-${n}`
        if (depth <= 2)
          headings.push({ id: base, text: text.replace(/<[^>]+>/g, ""), depth })
        return `<h${depth} id="${base}"><a class="anchor" href="#${base}" aria-label="Link to section">#</a>${text}</h${depth}>\n`
      },
      code({ text, lang }) {
        const language = (lang ?? "").trim().split(/\s+/)[0]
        if (language === "text") {
          promptCounter.count += 1
          const id = `prompt-${doc.id}-${promptCounter.count}`
          return (
            `<div class="prompt">` +
            `<div class="prompt-bar"><span>Copy-paste prompt</span>` +
            `<button type="button" class="copy" data-target="${id}">Copy</button></div>` +
            `<pre id="${id}"><code>${escapeHtml(text)}</code></pre></div>\n`
          )
        }
        if (language === "mermaid") {
          return `<figure class="mermaid"><figcaption>Diagram (Mermaid source — paste into any Mermaid renderer)</figcaption><pre><code>${escapeHtml(text)}</code></pre></figure>\n`
        }
        const cls = language ? ` class="language-${escapeHtml(language)}"` : ""
        return `<pre><code${cls}>${escapeHtml(text)}</code></pre>\n`
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens)
        const target = rewriteLink(href, doc.id)
        const t = title ? ` title="${escapeHtml(title)}"` : ""
        const external = /^https?:\/\//.test(target)
          ? ` target="_blank" rel="noreferrer noopener"`
          : ""
        return `<a href="${escapeHtml(target)}"${t}${external}>${text}</a>`
      },
    },
  })
  return marked
}

const css = `
:root{--bg:#fafaf8;--fg:#1c1c1a;--muted:#5f5f5a;--line:#e6e4dd;--accent:#0f766e;--accent-soft:#e6f4f1;--code:#f3f2ee;--warn:#9a3412;--sidebar:280px}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:var(--bg)}
a{color:var(--accent)}
.layout{display:grid;grid-template-columns:var(--sidebar) 1fr;min-height:100vh}
nav.sidebar{position:sticky;top:0;height:100vh;overflow:auto;border-right:1px solid var(--line);padding:20px 16px;background:#fff}
nav.sidebar h1{font-size:15px;margin:0 0 4px}
nav.sidebar .sub{font-size:12px;color:var(--muted);margin-bottom:16px}
nav.sidebar ol{list-style:none;padding:0;margin:0}
nav.sidebar li{margin:0}
nav.sidebar a.doc{display:block;padding:6px 8px;border-radius:6px;text-decoration:none;color:var(--fg);font-weight:600;font-size:13px}
nav.sidebar a.doc:hover,nav.sidebar a.doc.active{background:var(--accent-soft)}
nav.sidebar ol.sections{margin:0 0 6px 10px;border-left:1px solid var(--line)}
nav.sidebar ol.sections a{display:block;padding:2px 10px;font-size:12px;color:var(--muted);text-decoration:none}
nav.sidebar ol.sections a:hover{color:var(--accent)}
main{padding:32px 48px 96px;max-width:1040px}
article{padding-bottom:48px;margin-bottom:48px;border-bottom:2px solid var(--line)}
article:last-child{border-bottom:0}
.doc-meta{font-size:12px;color:var(--muted);margin:-8px 0 16px}
h1{font-size:30px;line-height:1.2;margin:0 0 12px}
h2{font-size:22px;margin:40px 0 12px;padding-top:8px;border-top:1px solid var(--line)}
h3{font-size:17px;margin:28px 0 8px}
h1 .anchor,h2 .anchor,h3 .anchor,h4 .anchor{opacity:0;margin-right:6px;text-decoration:none;color:var(--muted);font-weight:400}
h1:hover .anchor,h2:hover .anchor,h3:hover .anchor,h4:hover .anchor{opacity:1}
table{border-collapse:collapse;width:100%;margin:12px 0 20px;font-size:14px;display:block;overflow-x:auto}
th,td{border:1px solid var(--line);padding:6px 10px;vertical-align:top;text-align:left}
th{background:#f6f5f1}
code{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--code);padding:1px 5px;border-radius:4px}
pre{background:var(--code);padding:14px 16px;border-radius:8px;overflow:auto;border:1px solid var(--line)}
pre code{background:transparent;padding:0}
blockquote{margin:12px 0;padding:8px 16px;border-left:3px solid var(--accent);background:var(--accent-soft);color:var(--fg)}
.prompt{margin:16px 0 28px;border:1px solid var(--accent);border-radius:10px;overflow:hidden}
.prompt-bar{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--accent-soft);font-size:13px;font-weight:600;color:var(--accent)}
.prompt pre{margin:0;border:0;border-radius:0;max-height:640px;background:#fff}
button.copy{font:inherit;font-size:12px;font-weight:600;padding:5px 12px;border-radius:6px;border:1px solid var(--accent);background:#fff;color:var(--accent);cursor:pointer}
button.copy:hover{background:var(--accent);color:#fff}
button.copy.done{background:var(--accent);color:#fff}
figure.mermaid{margin:12px 0 20px}
figure.mermaid figcaption{font-size:12px;color:var(--muted);margin-bottom:4px}
.top{position:fixed;right:24px;bottom:24px;font-size:12px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 12px;text-decoration:none;color:var(--muted)}
input[type=checkbox]{margin-right:6px}
@media (max-width:960px){.layout{grid-template-columns:1fr}nav.sidebar{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}main{padding:24px 20px 80px}}
@media print{nav.sidebar,.top,button.copy{display:none}.layout{display:block}main{max-width:none;padding:0}}
`

const script = `
(function(){
  var buttons=document.querySelectorAll("button.copy");
  for(var i=0;i<buttons.length;i++){
    buttons[i].addEventListener("click",function(ev){
      var btn=ev.currentTarget;var pre=document.getElementById(btn.getAttribute("data-target"));
      if(!pre)return;var text=pre.textContent||"";
      var done=function(){btn.textContent="Copied";btn.classList.add("done");setTimeout(function(){btn.textContent="Copy";btn.classList.remove("done")},1600)};
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,function(){fallback(text);done()})}else{fallback(text);done()}
    });
  }
  function fallback(text){var ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.left="-9999px";document.body.appendChild(ta);ta.select();try{document.execCommand("copy")}catch(e){}document.body.removeChild(ta)}
  var links=document.querySelectorAll("nav.sidebar a.doc");var articles=document.querySelectorAll("main article");
  if("IntersectionObserver" in window){
    var io=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){for(var j=0;j<links.length;j++){links[j].classList.toggle("active",links[j].getAttribute("href")==="#"+e.target.id)}}})},{rootMargin:"-10% 0px -80% 0px"});
    for(var k=0;k<articles.length;k++){io.observe(articles[k])}
  }
})();
`

async function main() {
  const docs = await loadDocs()
  const promptCounter = { count: 0 }
  /** @type {{ doc: Doc, html: string, headings: Heading[] }[]} */
  const rendered = []
  for (const doc of docs) {
    /** @type {Heading[]} */
    const headings = []
    promptCounter.count = 0
    const marked = createRenderer(doc, headings, promptCounter)
    const html = await marked.parse(doc.markdown)
    rendered.push({ doc, html, headings })
  }

  const sidebar = rendered
    .map(({ doc, headings }) => {
      const sections = headings
        .filter((h) => h.depth === 2)
        .map((h) => `<li><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
        .join("")
      return (
        `<li><a class="doc" href="#${doc.id}">${escapeHtml(doc.title)}</a>` +
        (sections ? `<ol class="sections">${sections}</ol>` : "") +
        `</li>`
      )
    })
    .join("\n")

  const body = rendered
    .map(
      ({ doc, html }) =>
        `<article id="${doc.id}">\n<p class="doc-meta">Source: <code>docs/eleva-v3/execution-plan/${doc.file}</code></p>\n${html}</article>`
    )
    .join("\n")

  const totalPrompts = rendered.reduce(
    (n, r) => n + (r.html.match(/class="prompt"/g)?.length ?? 0),
    0
  )

  const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Eleva.care v3 — End-to-End Execution Plan</title>
<meta name="description" content="Phase-by-phase execution plan for Eleva.care v3 with copy-paste prompts. Generated from Markdown; do not edit by hand.">
<style>${css}</style>
</head>
<body>
<div class="layout">
<nav class="sidebar" aria-label="Plan navigation">
<h1>Eleva.care v3 — Execution Plan</h1>
<div class="sub">${docs.length - 1} phases · ${totalPrompts} copy-paste prompts · generated by <code>pnpm docs:execution-plan:html</code></div>
<ol>
${sidebar}
</ol>
</nav>
<main>
${body}
</main>
</div>
<a class="top" href="#readme">Back to top</a>
<script>${script}</script>
</body>
</html>
`
  await writeFile(outPath, page, "utf8")
  process.stdout.write(
    `Wrote ${path.relative(process.cwd(), outPath)} (${docs.length} documents, ${totalPrompts} prompts)\n`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
