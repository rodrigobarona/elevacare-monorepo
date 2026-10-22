/**
 * One-off port: eleva-care-app MDX → @eleva/content longform (sanitized for v3).
 * Run: node packages/content/scripts/port-legacy-longform.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../../..")
const legacyRoot = path.join(
  repoRoot,
  "_context/clone-repo/eleva-care-app/src/content"
)
const contentRoot = path.join(repoRoot, "packages/content/content")

const LAST_UPDATED = "2026-10-22"

/** @type {Array<{ out: string; legacy?: string; locales: string[]; fm: Record<string, { title: string; description: string; summary: string }> }>} */
const PORTS = [
  {
    out: "legal",
    legacy: "terms",
    locales: ["en", "pt", "es"],
    fm: {
      en: {
        title: "Terms of use — Eleva.care",
        description:
          "Terms for members, visitors, and experts using the Eleva.care digital health platform.",
        summary:
          "Platform role, bookings, cancellations, reviews, and governing law.",
      },
      pt: {
        title: "Termos de utilização — Eleva.care",
        description:
          "Termos para membros, visitantes e especialistas na plataforma digital Eleva.care.",
        summary:
          "Papel da plataforma, marcações, cancelamentos, avaliações e lei aplicável.",
      },
      es: {
        title: "Términos de uso — Eleva.care",
        description:
          "Términos para miembros, visitantes y expertos en la plataforma digital Eleva.care.",
        summary:
          "Rol de la plataforma, reservas, cancelaciones, reseñas y ley aplicable.",
      },
    },
    slug: "terms",
  },
  {
    out: "legal",
    legacy: "privacy",
    locales: ["en", "pt", "es"],
    fm: {
      en: {
        title: "Privacy notice — Eleva.care",
        description:
          "How BÚZIOS E TARTARUGAS, LDA processes personal data on Eleva.care.",
        summary:
          "Purposes, legal bases, retention, transfers, and your rights.",
      },
      pt: {
        title: "Política de privacidade — Eleva.care",
        description:
          "Como a BÚZIOS E TARTARUGAS, LDA trata dados pessoais na Eleva.care.",
        summary:
          "Finalidades, bases legais, conservação, transferências e os seus direitos.",
      },
      es: {
        title: "Aviso de privacidad — Eleva.care",
        description:
          "Cómo BÚZIOS E TARTARUGAS, LDA trata datos personales en Eleva.care.",
        summary:
          "Finalidades, bases legales, conservación, transferencias y sus derechos.",
      },
    },
    slug: "privacy",
  },
  {
    out: "legal",
    legacy: "cookie",
    locales: ["en", "pt", "es"],
    fm: {
      en: {
        title: "Cookie policy — Eleva.care",
        description: "Cookies and similar technologies used on eleva.care.",
        summary: "Categories, providers, and how to change your choices.",
      },
      pt: {
        title: "Política de cookies — Eleva.care",
        description:
          "Cookies e tecnologias similares utilizadas em eleva.care.",
        summary: "Categorias, fornecedores e como alterar as suas escolhas.",
      },
      es: {
        title: "Política de cookies — Eleva.care",
        description: "Cookies y tecnologías similares usadas en eleva.care.",
        summary: "Categorías, proveedores y cómo cambiar sus elecciones.",
      },
    },
    slug: "cookies",
  },
  {
    out: "legal",
    legacy: "payment-policies",
    locales: ["en", "pt", "es"],
    fm: {
      en: {
        title: "Payments and refunds — Eleva.care",
        description:
          "How bookings are paid through Stripe and how cancellation tiers affect refunds.",
        summary:
          "Platform fees, Flexible/Moderate/Strict policies, and invoicing.",
      },
      pt: {
        title: "Pagamentos e reembolsos — Eleva.care",
        description:
          "Como as marcações são pagas via Stripe e como os níveis de cancelamento afetam reembolsos.",
        summary:
          "Taxas da plataforma, políticas Flexível/Moderada/Rígida e faturação.",
      },
      es: {
        title: "Pagos y reembolsos — Eleva.care",
        description:
          "Cómo se pagan las reservas con Stripe y cómo los niveles de cancelación afectan los reembolsos.",
        summary:
          "Comisiones, políticas Flexible/Moderada/Estricta y facturación.",
      },
    },
    slug: "payments",
  },
  {
    out: "legal",
    legacy: "expert-agreement",
    locales: ["en", "pt", "es"],
    fm: {
      en: {
        title: "Expert agreement — Eleva.care",
        description:
          "Contractual terms for independent experts offering services on Eleva.care.",
        summary: "Ranking, payouts, conduct, DAC7 data, and platform changes.",
      },
      pt: {
        title: "Acordo de especialista — Eleva.care",
        description:
          "Termos contratuais para especialistas independentes na Eleva.care.",
        summary:
          "Posicionamento, pagamentos, conduta, dados DAC7 e alterações da plataforma.",
      },
      es: {
        title: "Acuerdo de experto — Eleva.care",
        description:
          "Términos contractuales para expertos independientes en Eleva.care.",
        summary:
          "Posicionamiento, pagos, conducta, datos DAC7 y cambios de la plataforma.",
      },
    },
    slug: "expert-agreement",
  },
  {
    out: "trust",
    legacy: "trust/security",
    locales: ["en", "pt", "es"],
    fm: {
      en: {
        title: "Security — Eleva.care",
        description: "Technical and organisational measures on Eleva.care.",
        summary:
          "Encryption, access control, audit logging, and vendor due diligence.",
      },
      pt: {
        title: "Segurança — Eleva.care",
        description: "Medidas técnicas e organizativas na Eleva.care.",
        summary:
          "Encriptação, controlo de acesso, auditoria e due diligence de fornecedores.",
      },
      es: {
        title: "Seguridad — Eleva.care",
        description: "Medidas técnicas y organizativas en Eleva.care.",
        summary:
          "Cifrado, control de acceso, auditoría y diligencia de proveedores.",
      },
    },
    slug: "security",
  },
  {
    out: "trust",
    legacy: "trust/dpa",
    locales: ["en", "pt", "es"],
    fm: {
      en: {
        title: "Data processing agreement — Eleva.care",
        description:
          "Processor terms when Eleva stores or transmits data on an expert's instructions.",
        summary: "Roles, subprocessors, transfers, and security measures.",
      },
      pt: {
        title: "Acordo de tratamento de dados — Eleva.care",
        description:
          "Termos de subcontratante quando a Eleva trata dados por instrução de um especialista.",
        summary:
          "Papéis, subcontratantes, transferências e medidas de segurança.",
      },
      es: {
        title: "Acuerdo de tratamiento de datos — Eleva.care",
        description:
          "Términos de encargado cuando Eleva trata datos bajo instrucciones de un experto.",
        summary: "Roles, subencargados, transferencias y medidas de seguridad.",
      },
    },
    slug: "dpa",
  },
]

function stripLegacyExports(raw) {
  let body = raw
  body = body.replace(/^---[\s\S]*?---\n/m, "")
  body = body.replace(/^export const metadata = \{[\s\S]*?\};\s*\n/m, "")
  body = body.replace(/^import[\s\S]*?from ['"]@\/[\s\S]*?;\s*\n/gm, "")
  body = body.replace(/^<[\s\S]*?\/>/gm, "")
  body = body.replace(/^\{/m, "")
  return body.trim()
}

function sanitize(body) {
  return body
    .replace(/\bClerk\b/g, "Better Auth")
    .replace(/\bWorkOS\b/g, "Better Auth")
    .replace(/\bNovu\b/g, "Eleva notifications")
    .replace(/\bpatients\b/gi, "members")
    .replace(/\bpatient\b/gi, "member")
    .replace(/\bclients\b/gi, "members")
    .replace(/\bclient\b/gi, "member")
    .replace(/\bworkspace\b/gi, "clinic")
    .replace(/HIPAA‑ready[^.\n]*/gi, "")
    .replace(/HIPAA-ready[^.\n]*/gi, "")
    .replace(/BAA executed[^.\n]*/gi, "")
    .replace(/maintain HIPAA[^.\n]*/gi, "")
    .replace(/LGPD[^,\n]*/gi, "applicable data protection law")
    .replace(/PostHog \(EU hosting\)/g, "analytics tools (only after consent)")
    .replace(/PostHog/g, "product analytics (when enabled and consented)")
    .replace(/\/legal\/cookie/g, "/legal/cookies")
    .replace(/Top Expert/gi, "verified expert")
    .replace(/95%/g, "")
    .replace(/44,894\+/g, "")
    .replace(/98%\+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function writeMdx(collection, locale, slug, fm, body) {
  const dir = path.join(contentRoot, collection, locale)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${slug}.mdx`)
  if (fs.existsSync(file) && collection === "legal") {
    const existing = fs.readFileSync(file, "utf8")
    if (existing.includes("lastUpdated: 2026-10-21") && slug !== "terms") {
      // keep hand-written accessibility/complaints
      if (slug === "accessibility" || slug === "complaints") return
    }
  }
  const yaml = `---
title: ${JSON.stringify(fm.title).slice(1, -1)}
description: ${JSON.stringify(fm.description).slice(1, -1)}
lastUpdated: ${LAST_UPDATED}
summary: ${JSON.stringify(fm.summary).slice(1, -1)}
---

`
  fs.writeFileSync(file, yaml + body + "\n", "utf8")
  console.log("wrote", path.relative(repoRoot, file))
}

for (const port of PORTS) {
  for (const locale of port.locales) {
    const legacyPath = port.legacy.includes("/")
      ? path.join(legacyRoot, ...port.legacy.split("/"), `${locale}.mdx`)
      : path.join(legacyRoot, port.legacy, `${locale}.mdx`)
    if (!fs.existsSync(legacyPath)) {
      console.warn("missing legacy", legacyPath)
      continue
    }
    const raw = fs.readFileSync(legacyPath, "utf8")
    const body = sanitize(stripLegacyExports(raw))
    writeMdx(port.out, locale, port.slug, port.fm[locale], body)
  }
}

/** New v3-only documents (no legacy file). */
const INLINE = {
  "legal/en/health-data.mdx": `---
title: Health data notice — Eleva.care
description: How Eleva processes special-category health data as platform operator and processor.
lastUpdated: ${LAST_UPDATED}
summary: Art. 9 GDPR bases, expert controller role, encryption, and retention.
---

## Roles

**BÚZIOS E TARTARUGAS, LDA** (Eleva.care) operates the booking and communication platform. **Independent experts** you choose deliver healthcare; they are **data controllers** for the clinical content of sessions, notes, and reports they create.

Eleva acts as **controller** for account, booking, payment, and support data, and as **processor** when it stores clinical artefacts on an expert's documented instructions (see our [Data processing agreement](/trust/dpa)).

## Categories of health data

Depending on how you use Eleva, we may process:

- Information you provide when booking or messaging (for example symptoms you choose to share before a session).
- Session metadata (time, expert, modality).
- Encrypted clinical notes, intake forms, and unpublished reports stored for the expert–member relationship.
- Live session transcripts generated for the expert workflow when that feature is enabled for the booking.

We do **not** use health data for advertising profiles.

## Legal bases (GDPR Article 9)

Experts rely on healthcare provisions (Article 9(2)(h)) and applicable professional duties for the care they deliver. Where Eleva stores health data as processor, processing follows the expert's instructions and our DPA. Where you give **explicit consent** (for example optional features described at booking), we record the consent version shown to you.

## Security

Health-related files use encrypted storage in the **private** blob store. Access is limited to authenticated roles required to operate the service. See [Security](/trust/security).

## Retention

Retention follows our data retention matrix: booking and billing records for legal and accounting periods; clinical content until the expert or member requests deletion subject to healthcare law; security logs for at least twelve months.

## Your rights

Contact [privacy@eleva.care](mailto:privacy@eleva.care). For clinical content controlled by an expert, we may direct you to them first. You may complain to the CNPD (Portugal).
`,
  "legal/pt/health-data.mdx": `---
title: Aviso sobre dados de saúde — Eleva.care
description: Como a Eleva trata dados de saúde (categoria especial) como operadora e subcontratante.
lastUpdated: ${LAST_UPDATED}
summary: Bases do art. 9.º RGPD, papel do especialista responsável, encriptação e conservação.
---

## Papéis

A **BÚZIOS E TARTARUGAS, LDA** (Eleva.care) opera a plataforma de marcação e comunicação. Os **especialistas independentes** que escolhe prestam cuidados de saúde; são **responsáveis pelo tratamento** do conteúdo clínico das sessões, notas e relatórios que criam.

A Eleva é **responsável** pelos dados de conta, marcação, pagamento e apoio, e **subcontratante** quando conserva artefactos clínicos por instrução documentada de um especialista (ver [Acordo de tratamento de dados](/trust/dpa)).

## Categorias de dados de saúde

Consoante a utilização, podemos tratar:

- Informação que faculta ao marcar ou mensagem (por exemplo sintomas que opta por partilhar antes da sessão).
- Metadados da sessão (hora, especialista, modalidade).
- Notas clínicas encriptadas, formulários de intake e relatórios não publicados para a relação especialista–membro.
- Transcrições de sessão geradas para o fluxo de trabalho do especialista quando a funcionalidade está ativa para a marcação.

**Não** utilizamos dados de saúde para publicidade comportamental.

## Bases legais (artigo 9.º RGPD)

Os especialistas invocam disposições de saúde (artigo 9.º, n.º 2, al. h)) e deveres profissionais aplicáveis. Quando a Eleva trata dados de saúde como subcontratante, o tratamento segue as instruções do especialista e o nosso ATD. Quando presta **consentimento explícito** (por exemplo funcionalidades opcionais descritas na marcação), registamos a versão apresentada.

## Segurança

Ficheiros relacionados com saúde usam armazenamento encriptado na loja **privada**. O acesso limita-se a funções autenticadas necessárias ao serviço. Ver [Segurança](/trust/security).

## Conservação

A conservação segue a nossa matriz de retenção: registos de marcação e faturação pelos prazos legais; conteúdo clínico até pedido de eliminação sujeito a lei de saúde; registos de segurança pelo menos doze meses.

## Os seus direitos

Contacte [privacy@eleva.care](mailto:privacy@eleva.care). Para conteúdo clínico controlado por um especialista, poderemos encaminhá-lo primeiro para ele. Pode reclamar junto da CNPD.
`,
  "legal/es/health-data.mdx": `---
title: Aviso sobre datos de salud — Eleva.care
description: Cómo Eleva trata datos de salud (categoría especial) como operador y encargado.
lastUpdated: ${LAST_UPDATED}
summary: Bases del art. 9 RGPD, rol del experto responsable, cifrado y conservación.
---

## Roles

**BÚZIOS E TARTARUGAS, LDA** (Eleva.care) opera la plataforma de reservas y comunicación. Los **expertos independientes** que elige prestan atención sanitaria; son **responsables del tratamiento** del contenido clínico de las sesiones, notas e informes que crean.

Eleva es **responsable** de los datos de cuenta, reserva, pago y soporte, y **encargado** cuando almacena artefactos clínicos según instrucciones documentadas de un experto (ver [Acuerdo de tratamiento de datos](/trust/dpa)).

## Categorías de datos de salud

Según el uso, podemos tratar:

- Información que facilita al reservar o mensajear (por ejemplo síntomas que decide compartir antes de la sesión).
- Metadatos de la sesión (hora, experto, modalidad).
- Notas clínicas cifradas, formularios de intake e informes no publicados para la relación experto–miembro.
- Transcripciones de sesión generadas para el flujo del experto cuando la función está activa para la reserva.

**No** usamos datos de salud para publicidad comportamental.

## Bases legales (artículo 9 RGPD)

Los expertos se apoyan en disposiciones de sanidad (artículo 9.2.h) y deberes profesionales aplicables. Cuando Eleva trata datos de salud como encargado, el tratamiento sigue las instrucciones del experto y nuestro DPA. Cuando da **consentimiento explícito** (por ejemplo funciones opcionales descritas en la reserva), registramos la versión mostrada.

## Seguridad

Los archivos relacionados con la salud usan almacenamiento cifrado en el almacén **privado**. El acceso se limita a roles autenticados necesarios para el servicio. Ver [Seguridad](/trust/security).

## Conservación

La conservación sigue nuestra matriz de retención: registros de reserva y facturación por plazos legales; contenido clínico hasta solicitud de supresión sujeta a ley sanitaria; registros de seguridad al menos doce meses.

## Sus derechos

Contacte [privacy@eleva.care](mailto:privacy@eleva.care). Para contenido clínico controlado por un experto, podemos remitirle primero a él. Puede reclamar ante la CNPD (Portugal).
`,
}

for (const [rel, content] of Object.entries(INLINE)) {
  const file = path.join(contentRoot, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content.trim() + "\n", "utf8")
  console.log("wrote", rel)
}

// AI processing (all locales) — fact-sheet aligned
for (const [locale, title, description, summary] of [
  [
    "en",
    "AI processing notice — Eleva.care",
    "How Eleva uses AI-assisted features and Vercel AI Gateway with EU inference.",
    "Editor assist, translation, provider, retention, and human review.",
  ],
  [
    "pt",
    "Aviso sobre tratamento com IA — Eleva.care",
    "Como a Eleva usa funcionalidades assistidas por IA e o Vercel AI Gateway com inferência na UE.",
    "Assistência de editor, tradução, fornecedor, retenção e revisão humana.",
  ],
  [
    "es",
    "Aviso sobre tratamiento con IA — Eleva.care",
    "Cómo Eleva usa funciones asistidas por IA y Vercel AI Gateway con inferencia en la UE.",
    "Asistencia de editor, traducción, proveedor, retención y revisión humana.",
  ],
]) {
  const body =
    locale === "en"
      ? `
## Features

Eleva may use AI to **suggest edits** in the expert service builder and to **draft translations** of user-visible text between English, Portuguese, and Spanish. These features assist humans; experts and editors remain responsible for published content.

## Provider and location

Requests are sent through **Vercel AI Gateway** to approved models (currently OpenAI models via the gateway). We configure **EU inference region** (requests fail if they cannot run in the EU zone) and **zero data retention** on the gateway path where our plan allows it. Providers may still retain content flagged for abuse review under their terms.

## Training

We do not send Eleva data to train public foundation models. Use is limited to providing the feature you request.

## Transparency (AI Act)

When AI-generated or AI-assisted text is shown in the product, we label it clearly where required. You can ignore suggestions and edit manually.

## Contact

Questions: [privacy@eleva.care](mailto:privacy@eleva.care).
`
      : locale === "pt"
        ? `
## Funcionalidades

A Eleva pode usar IA para **sugerir edições** no construtor de serviços do especialista e para **rascunhar traduções** de texto visível entre inglês, português e espanhol. Estas funcionalidades assistem pessoas; especialistas e editores permanecem responsáveis pelo conteúdo publicado.

## Fornecedor e localização

Os pedidos passam pelo **Vercel AI Gateway** para modelos aprovados (atualmente modelos OpenAI via gateway). Configuramos **inferência na região UE** (o pedido falha se não puder correr na zona UE) e **zero retenção de dados** no gateway quando o nosso plano o permite. Fornecedores podem ainda reter conteúdo sinalizado para revisão de abuso nos seus termos.

## Treino

Não enviamos dados da Eleva para treinar modelos públicos. A utilização limita-se à funcionalidade que solicita.

## Transparência (AI Act)

Quando texto gerado ou assistido por IA é mostrado no produto, identificamo-lo claramente quando exigido. Pode ignorar sugestões e editar manualmente.

## Contacto

Questões: [privacy@eleva.care](mailto:privacy@eleva.care).
`
        : `
## Funciones

Eleva puede usar IA para **sugerir ediciones** en el constructor de servicios del experto y para **borradores de traducción** de texto visible entre inglés, portugués y español. Estas funciones asisten a personas; expertos y editores siguen siendo responsables del contenido publicado.

## Proveedor y ubicación

Las solicitudes pasan por **Vercel AI Gateway** a modelos aprobados (actualmente modelos OpenAI vía gateway). Configuramos **inferencia en región UE** (la solicitud falla si no puede ejecutarse en la zona UE) y **cero retención de datos** en el gateway cuando nuestro plan lo permite. Los proveedores pueden retener contenido marcado para revisión de abuso según sus términos.

## Entrenamiento

No enviamos datos de Eleva para entrenar modelos públicos. El uso se limita a la función que solicita.

## Transparencia (AI Act)

Cuando se muestra texto generado o asistido por IA en el producto, lo etiquetamos claramente cuando se requiere. Puede ignorar sugerencias y editar manualmente.

## Contacto

Preguntas: [privacy@eleva.care](mailto:privacy@eleva.care).
`

  writeMdx(
    "legal",
    locale,
    "ai-processing",
    { title, description, summary },
    body.trim()
  )
}

// Sub-processors + ERS + evidence (simplified)
const subProcessorsEn = `
## Overview

Eleva uses vetted vendors under Article 28 GDPR contracts. This page lists **sub-processors** that handle personal data on our instructions. Transfer mechanisms combine **EU Standard Contractual Clauses** in each vendor DPA with **EU–US Data Privacy Framework** certification where the vendor maintains it (checked periodically).

| Vendor | Purpose | Location | Transfer basis |
| --- | --- | --- | --- |
| Vercel | Hosting, Functions (fra1), AI Gateway | EU / US | DPA + SCCs; DPF (Vercel Inc.) |
| Neon | PostgreSQL database | AWS eu-central-1 | DPA + SCCs; DPF (Databricks) |
| Upstash | Redis rate limits, QStash jobs | EU region when configured | DPA + SCCs; DPF |
| Resend | Transactional email | US storage | DPA Module 2 + DPF |
| Stripe | Payments and Connect | EU entity + US group | DPA (Ireland) + SCCs; DPF |
| Daily | Video rooms (recording off) | US metadata; EU media geo when set | DPA + DPF |
| Sentry | Error monitoring (EU data region) | EU (de.sentry.io) | DPA + DPF |
| Inth (c15t) | Consent records | EU (Frankfurt) | DPA when executed |

Google and Microsoft process calendar data as **independent controllers** when an expert connects OAuth; they are not Eleva subprocessors.

**Last vendor review:** ${LAST_UPDATED}. See also [Data processing agreement](/trust/dpa).
`

writeMdx(
  "trust",
  "en",
  "sub-processors",
  {
    title: "Sub-processors — Eleva.care",
    description: "Third parties that process personal data for Eleva.care.",
    summary: "Names, purposes, locations, and transfer mechanisms.",
  },
  subProcessorsEn.trim()
)

writeMdx(
  "trust",
  "pt",
  "sub-processors",
  {
    title: "Subcontratantes — Eleva.care",
    description: "Terceiros que tratam dados pessoais por conta da Eleva.care.",
    summary: "Nomes, finalidades, localizações e mecanismos de transferência.",
  },
  subProcessorsEn
    .replace("Sub-processors", "Subcontratantes")
    .replace("Overview", "Visão geral")
    .replace("Last vendor review", "Última revisão de fornecedores")
    .replace("Data processing agreement", "Acordo de tratamento de dados")
    .trim()
)

writeMdx(
  "trust",
  "es",
  "sub-processors",
  {
    title: "Subencargados — Eleva.care",
    description:
      "Terceros que tratan datos personales por cuenta de Eleva.care.",
    summary: "Nombres, finalidades, ubicaciones y mecanismos de transferencia.",
  },
  subProcessorsEn
    .replace("Sub-processors", "Subencargados")
    .replace("Overview", "Resumen")
    .replace("Last vendor review", "Última revisión de proveedores")
    .replace("Data processing agreement", "Acuerdo de tratamiento de datos")
    .trim()
)

const ersEn = `
## Eleva's role

Eleva.care is a **digital health platform**. We connect members with **independent, licensed experts**. Eleva **does not provide clinical care** and does not replace emergency services.

## Advertising and professional claims

Expert profiles and marketing copy must follow Portuguese health advertising rules and ERS guidance. Experts are responsible for accurate credentials and scope of practice. Eleva may remove content that is misleading or non-compliant with platform policies.

## Telehealth suitability

Experts decide when remote care is appropriate and when a member should seek in-person or emergency care.

## Questions

Clinical questions belong to your expert. Platform questions: [support@eleva.care](mailto:support@eleva.care).
`

for (const [locale, title, desc] of [
  [
    "en",
    "ERS and professional standards — Eleva.care",
    "How Eleva aligns with Portuguese digital health and advertising expectations.",
  ],
  [
    "pt",
    "ERS e standards profissionais — Eleva.care",
    "Como a Eleva se alinha com expectativas portuguesas de saúde digital e publicidade.",
  ],
  [
    "es",
    "ERS y estándares profesionales — Eleva.care",
    "Cómo Eleva se alinea con las expectativas portuguesas de salud digital y publicidad.",
  ],
]) {
  writeMdx(
    "trust",
    locale,
    "ers",
    {
      title,
      description: desc,
      summary:
        locale === "en"
          ? "Platform role, expert responsibility, and compliant marketing."
          : locale === "pt"
            ? "Papel da plataforma, responsabilidade do especialista e marketing conforme."
            : "Rol de la plataforma, responsabilidad del experto y marketing conforme.",
    },
    (locale === "pt"
      ? ersEn
          .replace(/Eleva's role/g, "Papel da Eleva")
          .replace(/Questions/g, "Questões")
      : locale === "es"
        ? ersEn
            .replace(/Eleva's role/g, "Rol de Eleva")
            .replace(/Questions/g, "Preguntas")
        : ersEn
    ).trim()
  )
}

const evidenceEn = `
## What we mean by evidence-based care

**Evidence-based care** means that experts ground recommendations in published research, clinical guidelines, and their professional judgement—not marketing slogans. Eleva.care provides the secure platform; **experts remain responsible** for the care they deliver.

## Telehealth in women's health

Systematic reviews and clinical guidelines support remote consultations for many non-urgent women's health needs when the expert judges them appropriate. Experts must recommend in-person or emergency care when indicated.

## How Eleva supports quality

- Verified professional profiles and documentation checks where required for platform integrity.
- Encrypted sessions and private storage for clinical artefacts.
- Clear cancellation and payment policies so members know what to expect.
- Editorial content (newsletter and podcast) separate from individual clinical advice.

## Not emergency care

Eleva is **not** for emergencies. If you think you are in danger, call your local emergency number.

## Learn more

- [About Eleva](/about)
- [Find an expert](/experts)
- [Complaints and dispute resolution](/legal/complaints)

## References

Selected sources our clinical advisors use when reviewing platform education (not exhaustive):

1. WHO digital health guidelines — [who.int](https://www.who.int/teams/digital-health-and-innovation)
2. ERS Portugal — [ers.pt](https://www.ers.pt)
`

for (const [locale, title, description, summary] of [
  [
    "en",
    "Evidence-based care — Eleva.care",
    "How Eleva thinks about research-informed women's health on a telehealth platform.",
    "Platform role, expert judgement, and selected references.",
  ],
  [
    "pt",
    "Cuidados baseados em evidência — Eleva.care",
    "Como a Eleva pensa saúde da mulher informada por investigação numa plataforma de telemedicina.",
    "Papel da plataforma, juízo clínico e referências selecionadas.",
  ],
  [
    "es",
    "Atención basada en evidencia — Eleva.care",
    "Cómo Eleva aborda la salud de la mujer informada por investigación en una plataforma de telemedicina.",
    "Rol de la plataforma, criterio clínico y referencias seleccionadas.",
  ],
]) {
  writeMdx(
    "pages",
    locale,
    "evidence-based-care",
    { title, description, summary },
    evidenceEn.trim()
  )
}

console.log("done")
