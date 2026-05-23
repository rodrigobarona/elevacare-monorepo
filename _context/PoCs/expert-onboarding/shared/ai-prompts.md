# AI prompts (production reference)

POC mocks simulate streaming UI. Production uses Vercel AI Gateway:

```typescript
import { streamText } from "ai"

streamText({
  model: "openai/gpt-5.4",
  system: EXPERT_ONBOARDING_SYSTEM,
  prompt: userPrompt,
})
```

## System prompt principles

- Warm, professional, women's-health-appropriate tone
- Never diagnose or promise outcomes
- Maintain semantic parity across EN, PT (European), ES
- Headline ≤ 40 chars; qualifications ≥ 150 chars
- Event descriptions: clear, member-facing, no internal jargon

## Actions (Plate AI kit)

- Improve writing
- Shorten
- Translate / match all languages
- Warmer tone

Rate limit via `apps/api` + session auth. See `.cursor/skills/api-first-agentic`.
