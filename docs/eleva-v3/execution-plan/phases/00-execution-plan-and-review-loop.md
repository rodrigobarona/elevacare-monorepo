# Phase 0 — Execution plan + CodeRabbit CLI review loop

| Field      | Value                                                                                                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch     | `phase-00/execution-plan-and-review-loop`                                                                                                                                                                              |
| Depends on | —                                                                                                                                                                                                                      |
| Effort     | 1-2 days                                                                                                                                                                                                               |
| Touches    | `docs/eleva-v3/execution-plan/**`, `package.json`, `.cursor/skills/coderabbit-review/`, `.cursor/rules/coderabbit-review.mdc`, `docs/eleva-v3/contribution-workflow.md`, `docs/eleva-v3/README.md`, `.coderabbit.yaml` |
| Exit gate  | `pnpm review` and `pnpm review:branch` work locally; `pnpm docs:execution-plan:html` regenerates `index.html`; plan merged to `main`                                                                                   |

## Why this phase exists

Every later phase relies on (a) a written, agreed plan with copy-paste prompts and (b) a
repeatable review loop that runs CodeRabbit **from the CLI** before a PR exists, then again through
the GitHub App on the PR. Phase 0 delivers both and nothing else, so it can merge fast and unblock
Phase 1.

## Scope

In:

- `docs/eleva-v3/execution-plan/README.md` — master plan (decisions, loop, phase index, preamble).
- `docs/eleva-v3/execution-plan/phases/00..16-*.md` — one file per phase, each ending in a
  copy-paste prompt.
- `docs/eleva-v3/execution-plan/build-html.mjs` + generated `index.html` (self-contained, offline,
  sidebar navigation, copy button on every prompt).
- Root scripts: `review`, `review:branch`, `review:agent`, `docs:execution-plan:html`.
- `.cursor/skills/coderabbit-review/SKILL.md` and `.cursor/rules/coderabbit-review.mdc` so agents
  run the loop automatically.
- `docs/eleva-v3/contribution-workflow.md` gains the "CLI review before PR" rule.
- `docs/eleva-v3/README.md` links the execution plan as the sequencing SSOT.
- `.coderabbit.yaml`: add `path_instructions` for `docs/eleva-v3/execution-plan/**` (prompts must
  stay self-contained and match README section 7 preamble).

Out: ADRs, code changes, CI changes (Phase 1).

## Deliverables

1. `docs/eleva-v3/execution-plan/README.md` with sections 1-10 as in this repo.
2. 17 phase files (`00` to `16`) following the same template: header table, why, scope, deliverables,
   acceptance criteria, tests, docs to update, local references, external docs (Context7 IDs),
   risks, copy-paste prompt.
3. `build-html.mjs` (uses the already-installed `marked`) that concatenates README + phases into
   `index.html` with a sidebar, anchors, and a copy button for each prompt block.
4. `package.json` scripts:
   - `"review": "coderabbit review --uncommitted --include-untracked"`
   - `"review:branch": "coderabbit review --committed --base main"`
   - `"review:agent": "coderabbit review --agent --base main"`
     (CodeRabbit CLI >= 0.7: plain text is the default output; `--plain`/`--type` no longer
     exist. Verify flags with `coderabbit review --help` and Context7 before changing them.)
   - `"docs:execution-plan:html": "node docs/eleva-v3/execution-plan/build-html.mjs"`
5. Skill + rule for the review loop; contribution workflow + handbook README updated.

## Acceptance criteria

- [ ] `pnpm review` runs CodeRabbit CLI against uncommitted changes and prints findings (or "no
      findings") — requires `coderabbit auth login` once per machine.
- [ ] `pnpm review:branch` compares the branch against `main`.
- [ ] `pnpm docs:execution-plan:html` regenerates `index.html` deterministically; the HTML opens
      offline, has a working sidebar and copy buttons.
- [ ] Every phase file has a `## Copy-paste prompt` section whose first block follows the README
      section 7 preamble (same steps, order and hard constraints; branch and relevant skills
      filled in) followed by phase-specific instructions.
- [ ] `docs/eleva-v3/README.md` and `contribution-workflow.md` reference the plan and the CLI loop.
- [ ] PR merged after the full loop (CLI clean, GitHub App zero unresolved comments, CI green).

## Tests

- `pnpm lint` (markdown is not linted; prettier formats it via lint-staged).
- Manual: open `index.html` in a browser, click a copy button, paste into an editor.

## Docs to update

- `docs/eleva-v3/README.md` — add "Execution plan" pointer near "How To Use This Handbook".
- `docs/eleva-v3/contribution-workflow.md` — new subsection "CodeRabbit CLI loop".

## Local references

- `docs/eleva-v3/roadmap-and-milestones.md`, `docs/eleva-v3/implementation-sprints.md` (superseded
  sequencing; keep for history, mark as superseded in Phase 1).
- `.coderabbit.yaml`, `.github/workflows/coderabbit.yml`, `.github/workflows/ci.yml`.
- `.cursor/skills/stripe-webhooks/SKILL.md` (skill format to copy).
- `AGENTS.md`.

## External docs

- CodeRabbit CLI: Context7 `/websites/coderabbit_ai` (search "CLI review --committed --uncommitted
  --agent --base"; reference page `docs.coderabbit.ai/cli/reference`).
- `marked` (HTML generation): `/markedjs/marked`.

## Risks

- CodeRabbit CLI requires an authenticated session; CI cannot run it headlessly without an API
  key. Mitigation: the CLI loop is a local/agent gate; the GitHub App remains the PR gate.

## Copy-paste prompt

````text
You are a senior engineer working in the Eleva.care v3 monorepo at the repository root
(/Users/<you>/…/elevacare-monorepo). Work autonomously and finish the phase end to end.

Before writing code:
1. Read AGENTS.md, .cursor/rules/*.mdc and the skills under .cursor/skills/ that match the files
   you will touch (api-first-agentic, audit-wiring, stripe-webhooks, eleva-icons, coderabbit-review).
2. Read docs/eleva-v3/execution-plan/README.md sections 2, 4, 6 and this phase file in full.
3. Read every file under "Local references" of this phase. Pull every library under
   "External docs" through Context7 (resolve-library-id then query-docs) and prefer those docs
   over memory for Next.js 16, Better Auth, Drizzle, Stripe, Daily, Resend, Twilio, next-intl,
   Vercel Flags/Workflows, Playwright, CodeRabbit.

Workflow (mandatory):
- git checkout main && git pull --ff-only && git checkout -b phase-00/execution-plan-and-review-loop
- Implement the deliverables in the order listed. Keep the PR under 150 reviewable files.
- Run: pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build
- Run: pnpm review  (CodeRabbit CLI on uncommitted changes) -> fix all findings -> repeat until clean
- Commit with Conventional Commits. Run: pnpm review:branch -> fix -> repeat until clean.
- git push -u origin <branch> && gh pr create --base main with the PR body template from
  docs/eleva-v3/execution-plan/README.md section 8.
- Loop: wait for CodeRabbit GitHub App review + CI; for each comment fix+push or reply
  "Not actionable because ..."; re-run pnpm review:branch; continue until zero unresolved
  comments and all checks green. Request human approval from @rodrigobarona.
- gh pr merge --squash --delete-branch; git checkout main && git pull.

Hard constraints: API-first (all route handlers in apps/api), agentic-first (Bearer/API key auth,
JSON, OpenAPI registered), secure by default (explicit auth model, Zod, rate limit, BotID on public
POSTs), withAudit on every write, RLS on every tenant table, vendor SDKs only inside their owning
package, no dead code left behind, members not "patients" in customer-facing copy, Spaces not
"Workspaces" for personal orgs, i18n keys for pt/en/es, cataloged dependency versions
(pnpm-workspace.yaml catalog), Phosphor icons via @eleva/icons only.

PHASE 0 TASK — Execution plan + CodeRabbit CLI review loop

Goal: produce the authoritative, copy-paste-ready execution plan (Markdown SSOT + generated HTML)
and the local CodeRabbit CLI review loop that every later phase uses.

Deliverables, in order:
1. docs/eleva-v3/execution-plan/README.md — sections: what we build (surfaces table), locked
   decisions ADR-017..021 table, current state + WorkOS blast radius, the phase loop (mermaid +
   9 rules), phase index table (phases 0-16 with branch names, effort, dependencies), target
   architecture mermaid + key contracts, universal prompt preamble, PR body template, risks,
   related docs.
2. docs/eleva-v3/execution-plan/phases/NN-slug.md for NN = 00..16. Template for each: header
   table (Branch, Depends on, Effort, Touches, Exit gate), Why, Scope in/out, Deliverables with
   exact file paths, Acceptance criteria checklist, Tests, Docs to update, Local references,
   External docs (Context7 IDs), Risks, "## Copy-paste prompt" containing the README section 7
   preamble followed by a fully self-contained task description (file paths, schemas, env vars,
   acceptance, reporting).
3. docs/eleva-v3/execution-plan/build-html.mjs — Node ESM script using the workspace-installed
   `marked` package: read README.md + phases/*.md in order, render to a single self-contained
   index.html (inline CSS, sidebar with one entry per file and per phase, heading anchors,
   a "Copy" button on every ```text prompt block implemented with navigator.clipboard, no
   external network requests, Eleva brand-neutral light theme). Deterministic output.
4. package.json root scripts: review, review:branch, review:agent, docs:execution-plan:html
   (exact commands in the phase file). Do not add new dependencies except `marked` if it is not
   already resolvable from the root (check node_modules/.pnpm first; add via catalog if needed).
5. .cursor/skills/coderabbit-review/SKILL.md (when to use, exact commands, how to triage findings,
   how to enumerate PR review threads with gh, when a finding may be declined) and
   .cursor/rules/coderabbit-review.mdc (alwaysApply: false, globs: none, description: "Run the
   CodeRabbit CLI loop before committing and before opening a PR").
6. Update docs/eleva-v3/contribution-workflow.md (new "CodeRabbit CLI loop" subsection) and
   docs/eleva-v3/README.md (pointer to execution-plan/README.md as sequencing SSOT). Add a
   path_instructions entry in .coderabbit.yaml for docs/eleva-v3/execution-plan/** asking the
   reviewer to flag prompts that are not self-contained or that contradict README section 2.
7. Run pnpm docs:execution-plan:html and commit index.html.

Acceptance: pnpm review works (after coderabbit auth login), pnpm review:branch works,
index.html opens offline with working sidebar + copy buttons, every phase file ends with a
prompt, handbook links updated, PR merged through the full loop.

Report at the end: list of files created/changed, the CodeRabbit CLI finding counts per run,
the PR URL, and anything you could not complete with the reason.
````
