---
name: coderabbit-review
description: Run the CodeRabbit CLI review loop locally before committing and before opening a PR, then drive the GitHub App review loop to zero unresolved comments. Use for every phase branch of the Eleva v3 execution plan and for any non-trivial PR.
---

# CodeRabbit Review Loop (CLI + GitHub App)

Every change to `main` goes through two CodeRabbit gates: the **CLI** (local, before a PR
exists) and the **GitHub App** (on the PR, required status check). This skill is the
operating manual for both. The sequencing SSOT is
`docs/eleva-v3/execution-plan/README.md` section 4.

## When to Use

- Before every commit on a `phase-NN/<slug>` branch (`pnpm review`).
- Before `git push` / `gh pr create` (`pnpm review:branch`).
- After every fix batch pushed to an open PR (`pnpm review:branch` again).
- When an agent needs structured findings to act on (`pnpm review:agent`).

## Prerequisites (once per machine)

```bash
# CLI is installed at ~/.local/bin/coderabbit (alias: cr). If missing:
curl -fsSL https://cli.coderabbit.ai/install.sh | sh
# Authenticate (opens a browser; use --agent for agent-driven OAuth):
coderabbit auth login
coderabbit auth status
```

CI cannot run the CLI headlessly without an API key. The CLI is a local/agent gate; the
GitHub App (`.github/workflows/coderabbit.yml` + `.coderabbit.yaml`) is the PR gate.

## Commands (root `package.json`)

| Script               | Command                                                  | Scope                                                    |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| `pnpm review`        | `coderabbit review --plain --type uncommitted`           | Staged + unstaged changes only                           |
| `pnpm review:branch` | `coderabbit review --plain --type committed --base main` | All commits on the branch vs `main`                      |
| `pnpm review:agent`  | `coderabbit review --agent --type all --base main`       | Structured findings for agents (committed + uncommitted) |

Useful flags: `--files <paths...>` to narrow scope, `--config AGENTS.md` to pass extra
instructions, `--dir <path>` to review one workspace, `--prompt-only` to print agent prompts.

The CLI reads `.coderabbit.yaml` (`path_instructions`, `path_filters`) — keep those in sync
with the architecture rules in `AGENTS.md`.

## The loop

```text
implement -> pnpm lint && pnpm typecheck && pnpm test && pnpm check:api-first-actions && pnpm build
          -> pnpm review        (fix every finding, re-run until "no findings")
          -> git commit (Conventional Commits)
          -> pnpm review:branch (fix, commit, re-run until clean)
          -> git push -u origin <branch> && gh pr create --base main
          -> GitHub App review + CI
          -> for each comment: fix + push, or reply "Not actionable because ..."
          -> pnpm review:branch after each fix batch
          -> zero unresolved comments + all checks green -> request human approval -> squash merge
```

## Triage rules for findings

1. **Fix by default.** A finding is fixed unless it is wrong about the code or contradicts a
   locked decision (`docs/eleva-v3/execution-plan/README.md` section 2, ADRs).
2. **Never weaken a rule to silence a finding** (no `eslint-disable`, no loosened Zod schema, no
   removed test, no `.coderabbit.yaml` filter added for the file at hand).
3. **Declining** is allowed only with a written reason in the PR body ("CodeRabbit CLI" section
   of the template in README section 8) and, on the PR, a reply on the thread starting with
   `Not actionable because ...`.
4. Security, tenant isolation (RLS / `withOrgContext`), audit coverage (`withAudit`), vendor SDK
   boundaries and PHI-in-logs findings are **never** declined — fix or escalate to the repo owner.
5. If a finding reveals a decision change, add a `docs/eleva-v3/decision-log.md` entry (and an
   ADR if material) in the same PR.

## Enumerating PR review threads

```bash
gh pr view --comments                                   # top-level + review summary
gh api repos/{owner}/{repo}/pulls/<n>/comments --paginate \
  --jq '.[] | {id, path, line, user: .user.login, body: .body[0:160]}'
gh api repos/{owner}/{repo}/pulls/<n>/reviews --jq '.[] | {user: .user.login, state}'
gh pr checks <n>                                        # CI + coderabbit status
```

Reply on a thread:

```bash
gh api repos/{owner}/{repo}/pulls/<n>/comments/<comment_id>/replies -f body='Fixed in <sha>.'
gh api repos/{owner}/{repo}/pulls/<n>/comments/<comment_id>/replies -f body='Not actionable because ...'
```

Ask CodeRabbit to re-review after a large push: comment `@coderabbitai review` on the PR.
Resolve threads in the GitHub UI (or via GraphQL `resolveReviewThread`) once addressed.

## PR size

CodeRabbit Pro skips PRs with more than 150 reviewable files. Check with
`git diff --name-only main...HEAD | wc -l` (after `path_filters`). Split into
`phase-NN.1/...`, `phase-NN.2/...` if needed — each split gets the full loop.

## Report format (end of a phase)

- CLI runs: `pnpm review` x N (findings: a, b, ... , 0), `pnpm review:branch` x M (...).
- GitHub App: N comments, all resolved; declined: `<none | list with reasons>`.
- CI: all green at `<sha>`. PR: `<url>`. Merged: `<yes/no>`.
