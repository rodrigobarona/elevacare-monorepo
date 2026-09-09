# POC C — Event First

Route: `/expert-onboarding/poc-c` · Registry: `apps/poc/src/domains/expert-onboarding/lib/registries/poc-c-steps.ts`

~15 steps — service-first, compliance deferred to dashboard checklist.

Localized writing: experts pick a **native language**, write once, then use **Translate with AI** to fill EN / PT / ES on the same screen (not separate steps per locale).

| Step ID | Goal | Next enabled |
|---------|------|--------------|
| `c-0-hook` | Interstitial: start with bookable session | always |
| `c-event-title` | Session title (all locales on one page) | min 5 chars in primary language |
| `c-duration` | Duration stepper | ≥ 30 min |
| `c-format` | Session format | 1 chip |
| `c-price` | Price stepper | ≥ €20 |
| `c-event-desc` | Description (all locales on one page) | min 20 chars in primary language |
| `c-ai-bridge` | AI profile draft animation | after headline filled |
| `c-upload` | Photos min 5 | 5 photos |
| `c-headline` | Headline (all locales on one page) | min 8 chars in primary language |
| `c-qual` | Qualifications (all locales on one page) | min 150 chars in primary language |
| `c-dashboard` | Dashboard checklist handoff | — |

Compliance is **not** inline — checklist items link to full gate later.

[← Domain hub](../../readme.md)
