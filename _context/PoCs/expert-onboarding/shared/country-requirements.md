# Country requirements (final gate)

Loaded based on `practiceCountry` selected early in the flow.

## Portugal (PT)

- NIF
- Professional license (e.g. OPP)
- TOConline invoicing path (post-identity)
- ERS telehealth self-certification acknowledgment
- Professional liability confirmation

## Spain (ES)

- NIF / IVA
- Colegio registration number
- Manual invoicing acknowledgment

## Brazil (BR)

- CPF / CNPJ
- Conselio profissional registration
- Manual invoicing acknowledgment

## All countries

- Stripe Identity (async checklist in Event-first / Express paths)
- Stripe Connect payouts
- Expert Terms acceptance
- Compliance Yes/No: valid license, insurance, independent practice

Reference: Airbnb PT registration hub in `_context/Onboarding-exxamples/airbnb.com/listing-property/docs/04-post-creation-compliance.md`
