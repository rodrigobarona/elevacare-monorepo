# ADR-009: AI Pipeline And Transcript Handling

## Status

Accepted

## Date

2026-04-22

## Context

Eleva uses AI to accelerate expert workflows (post-session report drafting, transcript summarization, CRM suggestions). This touches PHI-adjacent data (session transcripts, patient context) and must be compliant with GDPR/ERS/consent constraints.

We must also avoid locking Eleva into one LLM provider, manage costs, and provide fallback routing.

## Decision

- **Vercel AI Gateway** is the exclusive model router for Eleva AI pipelines.
- `packages/ai` owns all gateway interactions, prompt contracts, and pipeline definitions.
- **No direct LLM provider SDKs** (OpenAI, Anthropic, Mistral, etc.) outside `packages/ai`. CI verifies.
- Transcripts are **Eleva-owned records** stored in Neon, encrypted via WorkOS Vault references. Daily's transcript is the source; we copy into our store and control retention ourselves.
- AI reports are **drafts** by default; published only after explicit expert review/approval. Published reports include an audit trail of the draft → review → publish lifecycle.
- **Consent gate**: AI report generation for a session requires explicit consent from the patient (captured at booking time or session start).
- **Retention**: transcripts = 2 years from session; unpublished AI drafts = 90 days; published reports = 10 years.
- Prompt contracts are **versioned** so model or prompt changes produce a new contract version (for audit + reproducibility).

## Alternatives Considered

### Option A — Direct provider SDK per feature (OpenAI for reports, Anthropic for summaries)

- Pros: feature-specific model tuning
- Cons: no central cost tracking, no fallback routing, lock-in per feature, harder to audit

### Option B — LangChain / LlamaIndex

- Pros: orchestration frameworks
- Cons: overkill for Eleva's shape (prompts are simple, tools are bounded); add a heavy dependency

### Option C — Vercel AI Gateway (chosen)

- Pros: provider abstraction, cost tracking, fallback routing, first-party on our deploy platform, `ai` SDK ergonomics
- Cons: newer product; depends on Vercel's provider list (mitigated by ability to add providers)

## Consequences

- `packages/ai` is the only place model calls happen
- Transcript → AI report flow runs in `aiReportDraft` Vercel Workflow: fetch transcript from Neon → call gateway → persist draft → notify expert for review → on approval publish the report and fire `report_available` Lane 1 notification
- PHI rules:
  - transcript content never appears in notifications; the `report_available` email links to a signed URL
  - prompt inputs logged only in audit stream with redaction; full prompt bodies never in Sentry/BetterStack
- Cost and latency tracked per prompt contract; admin dashboard exposes spend per expert/clinic for fair attribution to AI credit add-ons
- Mobile diary data (once mobile ships) can flow into AI reports via consent-gated sharing (ADR-010)
